import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { products } from '@/lib/server/products';

export const runtime = 'edge';

const schema = z.object({
  productId: z.enum([
    'spikedate.plus.weekly',
    'spikedate.plus.monthly',
    'spikedate.lifts.1',
    'spikedate.lifts.3',
    'spikedate.lifts.10',
  ]),
  provider: z.enum(['mock', 'apple', 'google']),
  transactionId: z.string().trim().min(8).max(200),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Purchase details are invalid.' }, { status: 400 });
  if (
    parsed.data.provider === 'mock' &&
    (env as unknown as { SPIKEDATE_BILLING_MODE?: string })
      .SPIKEDATE_BILLING_MODE !== 'mock'
  )
    return json({ error: 'Mock billing is disabled.' }, { status: 403 });
  if (parsed.data.provider !== 'mock')
    return json(
      { error: 'Store receipt verification is not configured yet.' },
      { status: 501 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const prior = await db
      .prepare(
        'SELECT id, product_id, status FROM purchases WHERE provider = ? AND provider_transaction_id = ? LIMIT 1',
      )
      .bind(parsed.data.provider, parsed.data.transactionId)
      .first();
    if (prior) return json({ purchase: prior, duplicate: true });

    const product = products[parsed.data.productId];
    const now = Date.now();
    const purchaseId = identifier('pur');
    const idempotencyKey =
      parsed.data.provider + ':' + parsed.data.transactionId;
    const liftAmount = product.profileLifts;
    const superAmount = 'superSpikes' in product ? product.superSpikes : 0;
    const statements = [
      db
        .prepare(
          'INSERT INTO purchases ' +
            '(id, user_id, provider, provider_transaction_id, product_id, quantity, status, purchased_at, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          purchaseId,
          user.id,
          parsed.data.provider,
          parsed.data.transactionId,
          parsed.data.productId,
          1,
          'verified',
          now,
          now,
          now,
        ),
      db
        .prepare(
          'UPDATE entitlement_wallets SET profile_lifts = profile_lifts + ?, ' +
            'super_spikes = super_spikes + ?, weekly_lift_available = ?, ' +
            'version = version + 1, updated_at = ? WHERE user_id = ?',
        )
        .bind(
          liftAmount,
          superAmount,
          product.type === 'subscription' ? 1 : 0,
          now,
          user.id,
        ),
      db
        .prepare(
          'INSERT INTO entitlement_ledger ' +
            '(id, user_id, kind, delta, reason, idempotency_key, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          identifier('led'),
          user.id,
          'profile_lift',
          liftAmount,
          'purchase',
          idempotencyKey + ':lift',
          now,
          now,
        ),
    ];
    if (superAmount)
      statements.push(
        db
          .prepare(
            'INSERT INTO entitlement_ledger ' +
              '(id, user_id, kind, delta, reason, idempotency_key, created_at, updated_at) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            identifier('led'),
            user.id,
            'super_spike',
            superAmount,
            'subscription',
            idempotencyKey + ':spike',
            now,
            now,
          ),
      );
    if (product.type === 'subscription')
      statements.push(
        db
          .prepare(
            'INSERT INTO subscriptions ' +
              '(id, user_id, provider, provider_subscription_id, plan, status, current_period_ends_at, created_at, updated_at) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            identifier('sub'),
            user.id,
            parsed.data.provider,
            parsed.data.transactionId,
            product.plan,
            'active',
            now + (product.plan === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000,
            now,
            now,
          ),
      );
    await db.batch(statements);
    const wallet = await db
      .prepare(
        'SELECT super_spikes, profile_lifts, weekly_lift_available FROM entitlement_wallets WHERE user_id = ?',
      )
      .bind(user.id)
      .first();
    return json({ purchase: { id: purchaseId, status: 'verified' }, wallet });
  });
}
