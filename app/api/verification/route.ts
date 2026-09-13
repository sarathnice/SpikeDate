import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { reconcileDiscoverability } from '@/lib/server/profile-readiness';

export const runtime = 'edge';

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    consent: z.literal(true),
  }),
  z.object({
    action: z.literal('complete'),
    requestId: z.string().trim().min(8).max(100),
    metrics: z.object({
      brightness: z.number().min(0).max(255),
      sharpness: z.number().min(0).max(255),
      faceCount: z.number().int().min(0).max(10).nullable(),
      frameCount: z.number().int().min(1).max(10),
      captureDigest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  }),
]);

type VerificationMode = 'mock' | 'manual' | 'disabled';

function verificationMode(request: Request): VerificationMode {
  const configured = (
    env as unknown as { SPIKEDATE_FACE_VERIFICATION_MODE?: string }
  ).SPIKEDATE_FACE_VERIFICATION_MODE;
  if (configured === 'mock' || configured === 'disabled') return configured;
  if (configured === 'manual') return 'manual';
  const hostname = new URL(request.url).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1'
    ? 'mock'
    : 'manual';
}

function publicStatus(value: string | null) {
  if (value === 'verified') return 'photo_verified';
  if (
    value === 'photo_verified' ||
    value === 'identity_verified' ||
    value === 'pending' ||
    value === 'needs_review' ||
    value === 'needs_retry'
  )
    return value;
  return 'unverified';
}

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const [profile, latest] = await Promise.all([
      db
        .prepare('SELECT verification_status FROM profiles WHERE user_id = ?')
        .bind(user.id)
        .first<{ verification_status: string }>(),
      db
        .prepare(
          'SELECT id, provider, status, submitted_at, reviewed_at FROM verification_requests ' +
            'WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 1',
        )
        .bind(user.id)
        .first<{
          id: string;
          provider: string;
          status: string;
          submitted_at: number;
          reviewed_at: number | null;
        }>(),
    ]);
    return json({
      status: publicStatus(profile?.verification_status ?? null),
      request: latest ?? null,
      testMode: latest?.provider === 'local-camera-test',
    });
  });
}

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Review the camera-check information.' },
      { status: 400 },
    );
  const mode = verificationMode(request);
  if (mode === 'disabled')
    return json(
      { error: 'Photo verification is not enabled for this environment.' },
      { status: 503 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();

    if (parsed.data.action === 'start') {
      const attempts = await db
        .prepare(
          'SELECT COUNT(*) AS total FROM verification_requests WHERE user_id = ? AND submitted_at > ?',
        )
        .bind(user.id, now - 24 * 60 * 60 * 1000)
        .first<{ total: number }>();
      if ((attempts?.total ?? 0) >= 3)
        return json(
          {
            error:
              'You have reached today’s camera-check limit. Try again tomorrow.',
          },
          { status: 429 },
        );
      const id = identifier('verify');
      const provider = mode === 'mock' ? 'local-camera-test' : 'manual-review';
      await db.batch([
        db
          .prepare(
            "UPDATE verification_requests SET status = 'expired', updated_at = ? " +
              "WHERE user_id = ? AND status = 'pending'",
          )
          .bind(now, user.id),
        db
          .prepare(
            'INSERT INTO verification_requests ' +
              '(id, user_id, provider, provider_ref, status, submitted_at, reviewed_at, created_at, updated_at) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            id,
            user.id,
            provider,
            'consent-v1:' + crypto.randomUUID(),
            'pending',
            now,
            null,
            now,
            now,
          ),
        db
          .prepare(
            'UPDATE profiles SET verification_status = ?, updated_at = ? WHERE user_id = ?',
          )
          .bind('pending', now, user.id),
      ]);
      return json(
        {
          request: { id, status: 'pending', expiresAt: now + 5 * 60 * 1000 },
          testMode: mode === 'mock',
        },
        { status: 201 },
      );
    }

    const pending = await db
      .prepare(
        'SELECT id, provider, submitted_at, status FROM verification_requests WHERE id = ? AND user_id = ? LIMIT 1',
      )
      .bind(parsed.data.requestId, user.id)
      .first<{
        id: string;
        provider: string;
        submitted_at: number;
        status: string;
      }>();
    if (!pending || pending.status !== 'pending')
      return json(
        { error: 'This camera-check session is no longer active.' },
        { status: 409 },
      );
    if (pending.submitted_at < now - 5 * 60 * 1000) {
      await db
        .prepare(
          "UPDATE verification_requests SET status = 'expired', reviewed_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(now, now, pending.id)
        .run();
      return json(
        { error: 'The camera-check session expired. Start again.' },
        { status: 410 },
      );
    }

    const { brightness, sharpness, faceCount } = parsed.data.metrics;
    const qualityPassed =
      brightness >= 42 &&
      brightness <= 225 &&
      sharpness >= 4.5 &&
      faceCount !== 0 &&
      (faceCount === null || faceCount === 1);
    const status = !qualityPassed
      ? 'needs_retry'
      : pending.provider === 'local-camera-test'
        ? 'photo_verified'
        : 'needs_review';
    await db.batch([
      db
        .prepare(
          'UPDATE verification_requests SET provider_ref = ?, status = ?, reviewed_at = ?, updated_at = ? WHERE id = ?',
        )
        .bind(
          'capture-sha256:' + parsed.data.metrics.captureDigest,
          status,
          now,
          now,
          pending.id,
        ),
      db
        .prepare(
          'UPDATE profiles SET verification_status = ?, updated_at = ? WHERE user_id = ?',
        )
        .bind(status, now, user.id),
    ]);
    const readiness = await reconcileDiscoverability(db, user.id);
    return json({
      status,
      testMode: pending.provider === 'local-camera-test',
      retainedImage: false,
      readiness,
    });
  });
}

export async function DELETE(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    await db.batch([
      db
        .prepare('DELETE FROM verification_requests WHERE user_id = ?')
        .bind(user.id),
      db
        .prepare(
          'UPDATE profiles SET verification_status = ?, updated_at = ? WHERE user_id = ?',
        )
        .bind('unverified', now, user.id),
    ]);
    await reconcileDiscoverability(db, user.id);
    return json({ ok: true, status: 'unverified' });
  });
}
