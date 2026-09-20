import { env } from 'cloudflare:workers';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json } from '@/lib/server/http';
import { requireConnectionReady } from '@/lib/server/profile-readiness';
import { notifyUser } from '@/lib/server/notifications';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
type R2BucketLike = {
  put: (key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

const photoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const voiceTypes = new Set(['audio/webm', 'audio/mp4']);

function validSignature(kind: 'photo' | 'voice', mime: string, bytes: Uint8Array) {
  if (kind === 'photo') {
    if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mime === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    return mime === 'image/webp' && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  if (mime === 'audio/webm') return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return mime === 'audio/mp4' && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
}

async function readBounded(body: ReadableStream<Uint8Array> | null, maximum: number) {
  if (!body) return null;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > maximum) {
      await reader.cancel();
      return null;
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function POST(request: Request, context: Context) {
  const kind = request.headers.get('x-spikedate-kind');
  const mime = request.headers.get('content-type')?.split(';')[0].toLowerCase() ?? '';
  const clientId = request.headers.get('x-spikedate-client-id')?.trim() ?? '';
  const durationMs = Number(request.headers.get('x-spikedate-duration-ms') ?? '0');
  if (kind !== 'photo' && kind !== 'voice') return json({ error: 'Choose a photo or voice note.' }, { status: 400 });
  if (clientId.length < 8 || clientId.length > 120) return json({ error: 'Invalid upload ID.' }, { status: 400 });
  if (!(kind === 'photo' ? photoTypes : voiceTypes).has(mime))
    return json({ error: 'Unsupported photo or voice format.' }, { status: 415 });
  if (kind === 'voice' && (!Number.isInteger(durationMs) || durationMs < 300 || durationMs > 60_000))
    return json({ error: 'Voice notes must be 1–60 seconds.' }, { status: 400 });
  const maximum = kind === 'photo' ? 6 * 1024 * 1024 : 3 * 1024 * 1024;
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maximum) return json({ error: 'Attachment is too large.' }, { status: 413 });
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    if (!(await requireConnectionReady(db, user.id)))
      return json({ error: 'Verify and complete your profile before messaging.' }, { status: 403 });
    const { id } = await context.params;
    const recipient = await db.prepare(
      'SELECT CASE WHEN matches.user_a_id = ? THEN matches.user_b_id ELSE matches.user_a_id END AS user_id, profiles.display_name ' +
      'FROM conversations JOIN matches ON matches.id = conversations.match_id ' +
      'JOIN profiles ON profiles.user_id = ? WHERE conversations.id = ? AND matches.status = ? ' +
      'AND (matches.user_a_id = ? OR matches.user_b_id = ?) ' +
      "AND NOT EXISTS (SELECT 1 FROM safety_actions WHERE kind = 'block' AND " +
      '((reporter_id = matches.user_a_id AND subject_id = matches.user_b_id) OR ' +
      '(reporter_id = matches.user_b_id AND subject_id = matches.user_a_id))) LIMIT 1',
    ).bind(user.id, user.id, id, 'active', user.id, user.id).first<{ user_id: string; display_name: string }>();
    if (!recipient) return json({ error: 'Conversation not found.' }, { status: 404 });
    const existing = await db.prepare(
      'SELECT messages.id, messages.body, messages.delivered_at, message_media.kind, message_media.duration_ms ' +
      'FROM messages JOIN message_media ON message_media.message_id = messages.id ' +
      'WHERE messages.sender_id = ? AND messages.client_id = ? LIMIT 1',
    ).bind(user.id, clientId).first<{ id: string; body: string; delivered_at: number | null; kind: 'photo' | 'voice'; duration_ms: number | null }>();
    if (existing) return json({ message: { id: existing.id, body: existing.body, deliveredAt: existing.delivered_at, mediaKind: existing.kind, mediaDurationMs: existing.duration_ms }, duplicate: true });
    const bytes = await readBounded(request.body, maximum);
    if (!bytes || bytes.length < 16) return json({ error: 'Attachment is empty or too large.' }, { status: 413 });
    if (!validSignature(kind, mime, bytes)) return json({ error: 'Attachment does not match its file type.' }, { status: 415 });
    const bucket = (env as unknown as { MEDIA?: R2BucketLike }).MEDIA;
    if (!bucket) return json({ error: 'Private media storage is unavailable.' }, { status: 503 });
    const messageId = identifier('msg');
    const now = Date.now();
    const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
    const objectKey = `chat/${id}/${messageId}.${extension}`;
    const body = kind === 'photo' ? 'Photo' : 'Voice message';
    await bucket.put(objectKey, bytes, { httpMetadata: { contentType: mime } });
    try {
      await db.batch([
        db.prepare('INSERT INTO messages (id, conversation_id, sender_id, body, client_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(messageId, id, user.id, body, clientId, now, now),
        db.prepare('INSERT INTO message_media (message_id, object_key, kind, mime_type, size_bytes, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(messageId, objectKey, kind, mime, bytes.length, kind === 'voice' ? durationMs : null, now),
        db.prepare('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id),
      ]);
    } catch (error) {
      await bucket.delete(objectKey).catch(() => {});
      throw error;
    }
    await notifyUser(db, {
      userId: recipient.user_id,
      type: 'message',
      title: recipient.display_name || 'New message',
      body: kind === 'photo' ? 'Sent a photo' : 'Sent a voice note',
      data: { url: `/?chat=${id}`, conversationId: id },
    });
    return json({ message: { id: messageId, senderId: user.id, body, mediaKind: kind, mediaDurationMs: kind === 'voice' ? durationMs : null, deliveredAt: null, createdAt: now } }, { status: 201 });
  });
}
