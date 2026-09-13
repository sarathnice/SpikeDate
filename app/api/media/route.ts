import { env } from 'cloudflare:workers';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json } from '@/lib/server/http';

export const runtime = 'edge';

type R2BucketLike = {
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer,
    options: {
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
    },
  ) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

function mediaBucket() {
  const bucket = (env as unknown as { MEDIA?: R2BucketLike }).MEDIA;
  if (!bucket)
    throw new Response('Media storage is unavailable.', { status: 503 });
  return bucket;
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';')[0] ?? '';
  const photoTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ]);
  const videoTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
  const type = photoTypes.has(contentType)
    ? 'photo'
    : videoTypes.has(contentType)
      ? 'video'
      : null;
  if (!type)
    return json(
      { error: 'Use JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM.' },
      { status: 415 },
    );
  const length = Number(request.headers.get('content-length') || 0);
  const maximum = type === 'photo' ? 15 * 1024 * 1024 : 100 * 1024 * 1024;
  if (!length || length > maximum)
    return json(
      {
        error:
          type === 'photo'
            ? 'Photos must be under 15 MB.'
            : 'Videos must be under 100 MB.',
      },
      { status: 413 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const counts = await db
      .prepare(
        "SELECT SUM(CASE WHEN type = 'photo' THEN 1 ELSE 0 END) AS photos, " +
          "SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) AS videos, COUNT(*) AS total " +
          'FROM profile_media WHERE user_id = ?',
      )
      .bind(user.id)
      .first<{ photos: number | null; videos: number | null; total: number }>();
    if (type === 'photo' && (counts?.photos ?? 0) >= 6)
      return json(
        { error: 'Profiles can include up to 6 photos.' },
        { status: 409 },
      );
    if (type === 'video' && (counts?.videos ?? 0) >= 1)
      return json(
        { error: 'Profiles can include one video.' },
        { status: 409 },
      );
    const id = identifier('med');
    const extension = contentType.split('/')[1].replace('quicktime', 'mov');
    const objectKey = 'profiles/' + user.id + '/' + id + '.' + extension;
    const bucket = mediaBucket();
    await bucket.put(objectKey, request.body as ReadableStream, {
      httpMetadata: { contentType },
      customMetadata: { ownerId: user.id, mediaId: id },
    });
    const now = Date.now();
    try {
      await db
        .prepare(
          'INSERT INTO profile_media ' +
            '(id, user_id, object_key, type, position, moderation_status, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          user.id,
          objectKey,
          type,
          counts?.total ?? 0,
          'pending',
          now,
          now,
        )
        .run();
    } catch (error) {
      await bucket.delete(objectKey);
      throw error;
    }
    return json(
      {
        media: {
          id,
          type,
          position: counts?.total ?? 0,
          moderationStatus: 'pending',
          url: '/api/media/' + id,
        },
      },
      { status: 201 },
    );
  });
}
