import { env } from 'cloudflare:workers';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
type R2ObjectLike = {
  body: ReadableStream;
  etag?: string;
  httpMetadata?: { contentType?: string };
};
type R2BucketLike = {
  get: (key: string) => Promise<R2ObjectLike | null>;
  delete: (key: string) => Promise<void>;
};

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
    if (object.etag && request.headers.get('if-none-match') === object.etag)
      return new Response(null, {
        status: 304,
        headers: { etag: object.etag },
      });
    return new Response(object.body, {
      headers: {
        'cache-control': 'private, max-age=300',
        ...(object.etag ? { etag: object.etag } : {}),
        'content-type':
          object.httpMetadata?.contentType ?? 'application/octet-stream',
        'content-disposition': 'inline',
        'x-content-type-options': 'nosniff',
        'x-spikedate-explicit': media.explicit ? 'true' : 'false',
      },
    });
  });
}

export async function DELETE(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const media = await db
      .prepare(
        'SELECT object_key FROM profile_media WHERE id = ? AND user_id = ? LIMIT 1',
      )
      .bind(id, user.id)
      .first<{ object_key: string }>();
    if (!media) return json({ error: 'Media not found.' }, { status: 404 });
    await db
      .prepare('DELETE FROM profile_media WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .run();
    const remaining = await db
      .prepare(
        'SELECT id FROM profile_media WHERE user_id = ? ORDER BY position, created_at',
      )
      .bind(user.id)
      .all<{ id: string }>();
    if (remaining.results.length)
      await db.batch([
        ...remaining.results.map((item, index) =>
          db
            .prepare(
              'UPDATE profile_media SET position = ? WHERE id = ? AND user_id = ?',
            )
            .bind(100 + index, item.id, user.id),
        ),
        ...remaining.results.map((item, index) =>
          db
            .prepare(
              'UPDATE profile_media SET position = ? WHERE id = ? AND user_id = ?',
            )
            .bind(index, item.id, user.id),
        ),
      ]);
    const bucket = (env as unknown as { MEDIA?: R2BucketLike }).MEDIA;
    if (bucket) await bucket.delete(media.object_key);
    return json({ ok: true, id });
  });
}
