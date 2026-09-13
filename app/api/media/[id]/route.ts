import { env } from 'cloudflare:workers';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
type R2ObjectLike = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};
type R2BucketLike = { get: (key: string) => Promise<R2ObjectLike | null> };

export async function GET(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const media = await db
      .prepare(
        'SELECT user_id, object_key, moderation_status, explicit FROM profile_media WHERE id = ? LIMIT 1',
      )
      .bind(id)
      .first<{
        user_id: string;
        object_key: string;
        moderation_status: string;
        explicit: number;
      }>();
    if (!media) return json({ error: 'Media not found.' }, { status: 404 });
    if (media.user_id !== user.id && media.moderation_status !== 'approved')
      return json({ error: 'Media is awaiting review.' }, { status: 403 });
    const blocked = await db
      .prepare(
        "SELECT id FROM safety_actions WHERE kind = 'block' AND " +
          '((reporter_id = ? AND subject_id = ?) OR (reporter_id = ? AND subject_id = ?)) LIMIT 1',
      )
      .bind(user.id, media.user_id, media.user_id, user.id)
      .first();
    if (blocked) return json({ error: 'Media unavailable.' }, { status: 403 });
    const bucket = (env as unknown as { MEDIA?: R2BucketLike }).MEDIA;
    if (!bucket)
      return json({ error: 'Media storage is unavailable.' }, { status: 503 });
    const object = await bucket.get(media.object_key);
    if (!object) return json({ error: 'Media not found.' }, { status: 404 });
    return new Response(object.body, {
      headers: {
        'cache-control': 'private, max-age=300',
        'content-type':
          object.httpMetadata?.contentType ?? 'application/octet-stream',
        'x-content-type-options': 'nosniff',
        'x-spikedate-explicit': media.explicit ? 'true' : 'false',
      },
    });
  });
}
