import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { requireConnectionReady } from '@/lib/server/profile-readiness';
import { notifyUser } from '@/lib/server/notifications';

export const runtime = 'edge';

type Context = { params: Promise<{ id: string }> };
const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  clientId: z.string().trim().min(8).max(120),
});

async function canAccessConversation(
  db: ReturnType<typeof getDb>,
  conversationId: string,
  userId: string,
) {
  return db
    .prepare(
      'SELECT conversations.id FROM conversations JOIN matches ON matches.id = conversations.match_id ' +
        "WHERE conversations.id = ? AND matches.status = 'active' " +
        'AND (matches.user_a_id = ? OR matches.user_b_id = ?) LIMIT 1',
    )
    .bind(conversationId, userId, userId)
    .first();
}

export async function GET(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    if (!(await requireConnectionReady(db, user.id)))
      return json(
        { error: 'Verify and complete your profile before messaging.' },
        { status: 403 },
      );
    const { id } = await context.params;
    if (!(await canAccessConversation(db, id, user.id)))
      return json({ error: 'Conversation not found.' }, { status: 404 });
    const result = await db
      .prepare(
        'SELECT recent.*, message_media.kind AS media_kind, message_media.duration_ms AS media_duration_ms ' +
          'FROM (SELECT id, sender_id, body, delivered_at, read_at, created_at FROM messages ' +
          'WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 200) recent ' +
          'LEFT JOIN message_media ON message_media.message_id = recent.id ' +
          'ORDER BY recent.created_at ASC, recent.id ASC',
      )
      .bind(id)
      .all();
    return json({ messages: result.results });
  });
}

// Loading history is read-only. The receiving client acknowledges delivery after
// it receives the response, and reading only when the foreground UI sees a bubble.
export async function PATCH(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const idsSchema = z.array(z.string().min(1).max(120)).min(1).max(80);
  const parsed = z
    .object({
      messageIds: idsSchema.optional(),
      deliveredIds: idsSchema.optional(),
    })
    .refine((value) => Boolean(value.messageIds?.length || value.deliveredIds?.length))
    .safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Select up to 80 received or visible messages.' },
      { status: 400 },
    );
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    if (!(await canAccessConversation(db, id, user.id)))
      return json({ error: 'Conversation not found.' }, { status: 404 });
    const now = Date.now();
    const readIds = [...new Set(parsed.data.messageIds ?? [])];
    const deliveredIds = [...new Set(parsed.data.deliveredIds ?? [])];
    if (deliveredIds.length)
      await db
        .prepare(
          `UPDATE messages SET delivered_at = ?, updated_at = ? WHERE conversation_id = ? AND sender_id != ? AND delivered_at IS NULL AND deleted_at IS NULL AND id IN (${deliveredIds.map(() => '?').join(',')})`,
        )
        .bind(now, now, id, user.id, ...deliveredIds)
        .run();
    if (readIds.length)
      await db
        .prepare(
          `UPDATE messages SET delivered_at = COALESCE(delivered_at, ?), read_at = ?, updated_at = ? WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL AND deleted_at IS NULL AND id IN (${readIds.map(() => '?').join(',')})`,
        )
        .bind(now, now, now, id, user.id, ...readIds)
        .run();
    const allIds = [...new Set([...deliveredIds, ...readIds])];
    const result = await db
      .prepare(
        `SELECT id, delivered_at, read_at FROM messages WHERE conversation_id = ? AND sender_id != ? AND deleted_at IS NULL AND id IN (${allIds.map(() => '?').join(',')})`,
      )
      .bind(id, user.id, ...allIds)
      .all();
    return json({ messages: result.results });
  });
}

export async function POST(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Write a message up to 2,000 characters.' },
      { status: 400 },
    );
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    if (!(await canAccessConversation(db, id, user.id)))
      return json({ error: 'Conversation not found.' }, { status: 404 });
    const existing = await db
      .prepare(
        'SELECT id, body, delivered_at, read_at, created_at FROM messages WHERE sender_id = ? AND client_id = ? LIMIT 1',
      )
      .bind(user.id, parsed.data.clientId)
      .first();
    if (existing) return json({ message: existing, duplicate: true });
    const now = Date.now();
    const messageId = identifier('msg');
    await db.batch([
      db
        .prepare(
          'INSERT INTO messages ' +
            '(id, conversation_id, sender_id, body, client_id, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          messageId,
          id,
          user.id,
          parsed.data.body,
          parsed.data.clientId,
          now,
          now,
        ),
      db
        .prepare(
          'UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?',
        )
        .bind(now, now, id),
    ]);
    const recipient = await db
      .prepare(
        'SELECT CASE WHEN matches.user_a_id = ? THEN matches.user_b_id ELSE matches.user_a_id END AS user_id, ' +
          'profiles.display_name FROM conversations JOIN matches ON matches.id = conversations.match_id ' +
          'JOIN profiles ON profiles.user_id = ? WHERE conversations.id = ? LIMIT 1',
      )
      .bind(user.id, user.id, id)
      .first<{ user_id: string; display_name: string }>();
    if (recipient)
      await notifyUser(db, {
        userId: recipient.user_id,
        type: 'message',
        title: recipient.display_name || 'New message',
        body: parsed.data.body.slice(0, 120),
        data: { url: `/?chat=${id}`, conversationId: id },
      });
    return json(
      {
        message: {
          id: messageId,
          senderId: user.id,
          body: parsed.data.body,
          deliveredAt: null,
          createdAt: now,
        },
      },
      { status: 201 },
    );
  });
}
