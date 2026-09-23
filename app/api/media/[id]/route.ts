import { env } from 'cloudflare:workers';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';
import {
  invalidatePhotoVerification,
  reconcileDiscoverability,
} from '@/lib/server/profile-readiness';
import { mediaResponseBody } from '@/lib/media-response';
import { optimizeProfileImage } from '@/lib/server/image-delivery';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
type R2ObjectLike = {
  body: ReadableStream;
  etag?: string;
  httpMetadata?: { contentType?: string };
};
type R2BucketLike = {
  get: (key: string) => Promise<R2ObjectLike | null>;
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

const photoTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function validPhotoSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png')
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  if (contentType === 'image/webp')
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  if (contentType === 'image/heic' || contentType === 'image/heif') {
    const brand = String.fromCharCode(...bytes.slice(4, 12));
    return /ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(brand);
  }
  return false;
}

export async function GET(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const media = await db
      .prepare(
        'SELECT user_id, object_key, original_object_key, card_object_key, avatar_object_key, width, height, moderation_status, explicit FROM profile_media WHERE id = ? LIMIT 1',
      )
      .bind(id)
      .first<{
        user_id: string;
        object_key: string;
        original_object_key: string | null;
        card_object_key: string | null;
        avatar_object_key: string | null;
        width: number | null;
        height: number | null;
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
    const requestedVariant = new URL(request.url).searchParams.get('variant');
    const variant =
      requestedVariant === 'card' ||
      requestedVariant === 'avatar' ||
      requestedVariant === 'original'
        ? requestedVariant
        : 'full';
    if (variant === 'original' && media.user_id !== user.id)
      return json({ error: 'Original media is private.' }, { status: 403 });
    const selectedKey =
      variant === 'original'
        ? (media.original_object_key ?? media.object_key)
        : variant === 'card'
          ? (media.card_object_key ?? media.object_key)
          : variant === 'avatar'
            ? (media.avatar_object_key ??
              media.card_object_key ??
              media.object_key)
            : media.object_key;
    const object = await bucket.get(selectedKey);
    if (!object) return json({ error: 'Media not found.' }, { status: 404 });
    if (
      (env as unknown as { SPIKEDATE_IMAGES_ENABLED?: string })
        .SPIKEDATE_IMAGES_ENABLED !== 'true' &&
      object.etag &&
      request.headers.get('if-none-match') === object.etag
    )
      return new Response(null, {
        status: 304,
        headers: { etag: object.etag },
      });
    const responseMedia = await mediaResponseBody(
      object.body,
      object.httpMetadata?.contentType,
    );
    const response = new Response(responseMedia.body, {
      headers: {
        'cache-control': 'private, max-age=3600, stale-while-revalidate=86400',
        ...(object.etag ? { etag: object.etag } : {}),
        'content-type': responseMedia.contentType,
        'content-disposition': 'inline',
        'x-content-type-options': 'nosniff',
        'x-spikedate-explicit': media.explicit ? 'true' : 'false',
        'x-spikedate-image-variant': variant,
      },
    });
    const imageCache = (caches as unknown as { default?: Cache }).default;
    return optimizeProfileImage(
      request,
      response,
      env as unknown as Parameters<typeof optimizeProfileImage>[2],
      variant,
      imageCache,
      {
        lowResolution:
          media.width !== null &&
          media.height !== null &&
          (media.width < 900 || media.height < 1125),
      },
    );
  });
}

export async function PUT(request: Request, context: Context) {
  const variant = new URL(request.url).searchParams.get('variant');
  if (variant !== 'original' && variant !== 'card' && variant !== 'avatar') {
    await request.body?.cancel();
    return json(
      { error: 'Choose original, card, or avatar.' },
      { status: 400 },
    );
  }
  const contentType = request.headers.get('content-type')?.split(';')[0] ?? '';
  if (!photoTypes.has(contentType)) {
    await request.body?.cancel();
    return json(
      { error: 'Use JPEG, PNG, WebP, HEIC, or HEIF.' },
      { status: 415 },
    );
  }
  const length = Number(request.headers.get('content-length') || 0);
  const maximum = variant === 'original' ? 15 * 1024 * 1024 : 6 * 1024 * 1024;
  if (!length || length > maximum) {
    await request.body?.cancel();
    return json({ error: 'This photo variant is too large.' }, { status: 413 });
  }
  if (!request.body)
    return json({ error: 'The upload was empty.' }, { status: 400 });
  const [validationBody, storageBody] = request.body.tee();
  const reader = validationBody.getReader();
  const first = await reader.read();
  await reader.cancel();
  if (
    !validPhotoSignature(
      contentType,
      first.value?.slice(0, 16) ?? new Uint8Array(),
    )
  ) {
    await storageBody.cancel();
    return json(
      { error: 'The file contents do not match the photo type.' },
      { status: 415 },
    );
  }

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) {
      await storageBody.cancel();
      return user;
    }
    const { id } = await context.params;
    const media = await db
      .prepare(
        'SELECT type, original_object_key, card_object_key, avatar_object_key FROM profile_media WHERE id = ? AND user_id = ? LIMIT 1',
      )
      .bind(id, user.id)
      .first<{
        type: string;
        original_object_key: string | null;
        card_object_key: string | null;
        avatar_object_key: string | null;
      }>();
    if (!media || media.type !== 'photo') {
      await storageBody.cancel();
      return json({ error: 'Photo not found.' }, { status: 404 });
    }
    const bucket = (env as unknown as { MEDIA?: R2BucketLike }).MEDIA;
    if (!bucket) {
      await storageBody.cancel();
      return json({ error: 'Media storage is unavailable.' }, { status: 503 });
    }
    const extension = contentType.split('/')[1];
    const objectKey =
      'profiles/' + user.id + '/' + id + '/' + variant + '.' + extension;
    await bucket.put(objectKey, storageBody, {
      httpMetadata: { contentType },
      customMetadata: { ownerId: user.id, mediaId: id, variant },
    });
    const column =
      variant === 'original'
        ? 'original_object_key'
        : variant === 'card'
          ? 'card_object_key'
          : 'avatar_object_key';
    const previousKey =
      variant === 'original'
        ? media.original_object_key
        : variant === 'card'
          ? media.card_object_key
          : media.avatar_object_key;
    await db
      .prepare(
        `UPDATE profile_media SET ${column} = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      )
      .bind(objectKey, Date.now(), id, user.id)
      .run();
    if (variant === 'original') {
      await invalidatePhotoVerification(db, user.id);
      await reconcileDiscoverability(db, user.id);
    }
    if (previousKey && previousKey !== objectKey)
      await bucket.delete(previousKey);
    return json({ ok: true, id, variant });
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
        'SELECT object_key, original_object_key, card_object_key, avatar_object_key FROM profile_media WHERE id = ? AND user_id = ? LIMIT 1',
      )
      .bind(id, user.id)
      .first<{
        object_key: string;
        original_object_key: string | null;
        card_object_key: string | null;
        avatar_object_key: string | null;
      }>();
    if (!media) return json({ error: 'Media not found.' }, { status: 404 });
    await db
      .prepare('DELETE FROM profile_media WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .run();
    await invalidatePhotoVerification(db, user.id);
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
    if (bucket) {
      const keys = new Set(
        [
          media.object_key,
          media.original_object_key,
          media.card_object_key,
          media.avatar_object_key,
        ].filter((key): key is string => Boolean(key)),
      );
      await Promise.all([...keys].map((key) => bucket.delete(key)));
    }
    await reconcileDiscoverability(db, user.id);
    return json({ ok: true, id });
  });
}
