import { env } from 'cloudflare:workers';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
type R2BucketLike = { get: (key: string) => Promise<{ body: ReadableStream } | null> };

export async function GET(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const media = await db.prepare(
      'SELECT message_media.object_key, message_media.mime_type FROM message_media ' +
      'JOIN messages ON messages.id = message_media.message_id ' +
      'JOIN conversations ON conversations.id = messages.conversation_id ' +
      'JOIN matches ON matches.id = conversations.match_id ' +
      'WHERE messages.id = ? AND messages.deleted_at IS NULL AND matches.status = ? ' +
      'AND (matches.user_a_id = ? OR matches.user_b_id = ?) ' +
      "AND NOT EXISTS (SELECT 1 FROM safety_actions WHERE kind = 'block' AND " +
      '((reporter_id = matches.user_a_id AND subject_id = matches.user_b_id) OR ' +
      '(reporter_id = matches.user_b_id AND subject_id = matches.user_a_id))) LIMIT 1',
    ).bind(id, 'active', user.id, user.id).first<{ object_key: string; mime_type: string }>();
    if (!media) return json({ error: 'Attachment not found.' }, { status: 404 });
    const bucket = (env as unknown as { MEDIA?: R2BucketLike }).MEDIA;
    if (!bucket) return json({ error: 'Private media storage is unavailable.' }, { status: 503 });
    const object = await bucket.get(media.object_key);
    if (!object) return json({ error: 'Attachment not found.' }, { status: 404 });
    return new Response(object.body, {
      headers: {
        'content-type': media.mime_type,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
        'content-disposition': 'inline',
      },
    });
  });
}
