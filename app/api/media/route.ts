import { env } from 'cloudflare:workers';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { reconcileDiscoverability } from '@/lib/server/profile-readiness';

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

function boundedHeader(
  request: Request,
  name: string,
  minimum: number,
  maximum: number,
) {
  const raw = request.headers.get(name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? Math.round(value)
    : null;
}

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
    'image/heif',
  ]);
  const videoTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
  const type = photoTypes.has(contentType)
    ? 'photo'
    : videoTypes.has(contentType)
      ? 'video'
      : null;
  if (!type) {
    await request.body?.cancel();
    return json(
      { error: 'Use JPEG, PNG, WebP, HEIC, MP4, MOV, or WebM.' },
      { status: 415 },
    );
  }
  const length = Number(request.headers.get('content-length') || 0);
  const maximum = type === 'photo' ? 15 * 1024 * 1024 : 30 * 1024 * 1024;
  if (!length || length > maximum) {
    await request.body?.cancel();
    return json(
      {
        error:
          type === 'photo'
            ? 'Photos must be under 15 MB.'
            : 'Videos must be under 30 MB.',
      },
      { status: 413 },
    );
  }

  if (!request.body)
    return json({ error: 'The upload was empty.' }, { status: 400 });
  const durationSeconds = Number(
    request.headers.get('x-spikedate-duration-seconds') || 0,
  );
  if (
    type === 'video' &&
    (!Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 ||
      durationSeconds > 15.25)
  ) {
    await request.body.cancel();
    return json(
      { error: 'Profile videos must be 15 seconds or shorter.' },
      { status: 413 },
    );
  }
  const [validationBody, storageBody] = request.body.tee();
  if (type === 'photo') {
    const reader = validationBody.getReader();
    const first = await reader.read();
    await reader.cancel();
    const bytes = first.value?.slice(0, 16) ?? new Uint8Array();
    if (!validPhotoSignature(contentType, bytes))
      return json(
        { error: 'The file contents do not match the selected photo type.' },
        { status: 415 },
      );
  } else {
    await validationBody.cancel();
  }

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
    const objectKey =
      type === 'photo'
        ? 'profiles/' + user.id + '/' + id + '/full.' + extension
        : 'profiles/' + user.id + '/' + id + '.' + extension;
    const bucket = mediaBucket();
    const configuredModeration = (
      env as unknown as { SPIKEDATE_MEDIA_MODERATION_MODE?: string }
    ).SPIKEDATE_MEDIA_MODERATION_MODE;
    const hostname = new URL(request.url).hostname;
    const moderationStatus =
      configuredModeration === 'mock' ||
      (!configuredModeration &&
        (hostname === 'localhost' || hostname === '127.0.0.1'))
        ? 'approved'
        : 'pending';
    await bucket.put(objectKey, storageBody, {
      httpMetadata: { contentType },
      customMetadata: {
        ownerId: user.id,
        mediaId: id,
        ...(type === 'video'
          ? { durationSeconds: String(durationSeconds) }
          : { variants: 'card,full;format=auto' }),
      },
    });
    const now = Date.now();
    const width =
      type === 'photo'
        ? boundedHeader(request, 'x-spikedate-width', 1, 12000)
        : null;
    const height =
      type === 'photo'
        ? boundedHeader(request, 'x-spikedate-height', 1, 12000)
        : null;
    const sourceWidth =
      type === 'photo'
        ? boundedHeader(request, 'x-spikedate-source-width', 1, 24000)
        : null;
    const sourceHeight =
      type === 'photo'
        ? boundedHeader(request, 'x-spikedate-source-height', 1, 24000)
        : null;
    const focalX =
      type === 'photo'
        ? boundedHeader(request, 'x-spikedate-focal-x', 0, 10000)
        : null;
    const focalY =
      type === 'photo'
        ? boundedHeader(request, 'x-spikedate-focal-y', 0, 10000)
        : null;
    const cropZoom =
      type === 'photo'
        ? boundedHeader(request, 'x-spikedate-crop-zoom', 1000, 2200)
        : null;
    try {
      await db
        .prepare(
          'INSERT INTO profile_media ' +
            '(id, user_id, object_key, type, position, width, height, source_width, source_height, focal_x, focal_y, crop_zoom, moderation_status, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          user.id,
          objectKey,
          type,
          counts?.total ?? 0,
          width,
          height,
          sourceWidth,
          sourceHeight,
          focalX,
          focalY,
          cropZoom,
          moderationStatus,
          now,
          now,
        )
        .run();
      await reconcileDiscoverability(db, user.id);
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
          moderationStatus,
          url: '/api/media/' + id + (type === 'photo' ? '?variant=full' : ''),
        },
      },
      { status: 201 },
    );
  });
}

export async function PATCH(request: Request) {
  const input = await readJson<{ mediaIds?: unknown }>(request);
  if (input instanceof Response) return input;
  if (
    !Array.isArray(input.mediaIds) ||
    input.mediaIds.length < 1 ||
    input.mediaIds.length > 7 ||
    input.mediaIds.some((id) => typeof id !== 'string') ||
    new Set(input.mediaIds).size !== input.mediaIds.length
  )
    return json({ error: 'Choose a valid media order.' }, { status: 400 });
  const mediaIds = input.mediaIds as string[];

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const owned = await db
      .prepare(
        'SELECT id FROM profile_media WHERE user_id = ? ORDER BY position',
      )
      .bind(user.id)
      .all<{ id: string }>();
    const ownedIds = new Set(owned.results.map((item) => item.id));
    if (
      mediaIds.length !== ownedIds.size ||
      mediaIds.some((id) => !ownedIds.has(id))
    )
      return json(
        { error: 'Media order does not match this profile.' },
        { status: 403 },
      );
    const now = Date.now();
    await db.batch([
      ...mediaIds.map((id, index) =>
        db
          .prepare(
            'UPDATE profile_media SET position = ?, updated_at = ? WHERE id = ? AND user_id = ?',
          )
          .bind(100 + index, now, id, user.id),
      ),
      ...mediaIds.map((id, index) =>
        db
          .prepare(
            'UPDATE profile_media SET position = ?, updated_at = ? WHERE id = ? AND user_id = ?',
          )
          .bind(index, now, id, user.id),
      ),
    ]);
    return json({ ok: true, mediaIds });
  });
}
