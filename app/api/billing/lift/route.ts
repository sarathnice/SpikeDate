import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { z } from 'zod';

export const runtime = 'edge';

const schema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  source: z.enum(['purchased', 'weekly']),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Profile Lift request is invalid.' }, { status: 400 });

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const existing = await db
      .prepare(
        'SELECT id, starts_at, ends_at FROM profile_lift_activations ' +
          'WHERE user_id = ? AND ends_at > ? ORDER BY ends_at DESC LIMIT 1',
      )
      .bind(user.id, Date.now())
      .first();
    if (existing) return json({ activation: existing, alreadyActive: true });
    const duplicate = await db
      .prepare(
        'SELECT id FROM entitlement_ledger WHERE idempotency_key = ? LIMIT 1',
      )
      .bind(parsed.data.idempotencyKey)
      .first();
    if (duplicate)
      return json(
        { error: 'This request was already processed.' },
        { status: 409 },
      );

    const wallet = await db
      .prepare(
        'SELECT profile_lifts, weekly_lift_available FROM entitlement_wallets WHERE user_id = ?',
      )
      .bind(user.id)
      .first<{ profile_lifts: number; weekly_lift_available: number }>();
    const available =
      parsed.data.source === 'weekly'
        ? Boolean(wallet?.weekly_lift_available)
        : (wallet?.profile_lifts ?? 0) > 0;
    if (!available)
      return json(
        { error: 'No Profile Lifts are available.' },
        { status: 409 },
      );

    const now = Date.now();
    const endsAt = now + 30 * 60 * 1000;
    const activationId = identifier('lift');
    await db.batch([
      db
        .prepare(
          parsed.data.source === 'weekly'
            ? 'UPDATE entitlement_wallets SET weekly_lift_available = 0, version = version + 1, updated_at = ? WHERE user_id = ? AND weekly_lift_available = 1'
            : 'UPDATE entitlement_wallets SET profile_lifts = profile_lifts - 1, version = version + 1, updated_at = ? WHERE user_id = ? AND profile_lifts > 0',
        )
        .bind(now, user.id),
      db
        .prepare(
          'INSERT INTO entitlement_ledger ' +
            '(id, user_id, kind, delta, reason, idempotency_key, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          identifier('led'),
          user.id,
          parsed.data.source === 'weekly' ? 'weekly_lift' : 'profile_lift',
          -1,
          'activation',
          parsed.data.idempotencyKey,
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO profile_lift_activations ' +
            '(id, user_id, source, starts_at, ends_at, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(activationId, user.id, parsed.data.source, now, endsAt, now, now),
    ]);
    return json(
      {
        activation: {
          id: activationId,
          startsAt: now,
          endsAt,
          source: parsed.data.source,
        },
      },
      { status: 201 },
    );
  });
}

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const [wallet, active] = await Promise.all([
      db
        .prepare(
          'SELECT super_spikes, profile_lifts, weekly_lift_available FROM entitlement_wallets WHERE user_id = ?',
        )
        .bind(user.id)
        .first(),
      db
        .prepare(
          'SELECT id, source, starts_at, ends_at FROM profile_lift_activations ' +
            'WHERE user_id = ? AND ends_at > ? ORDER BY ends_at DESC LIMIT 1',
        )
        .bind(user.id, Date.now())
        .first(),
    ]);
    return json({ wallet, active });
  });
}
