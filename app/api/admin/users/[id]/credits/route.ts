import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  kind: z.enum(['super_spike', 'profile_lift']),
  amount: z.number().int().min(1).max(10),
  reason: z.string().trim().min(10).max(500),
  requestId: z.string().uuid(),
});

export async function POST(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: 'Choose 1–10 credits and record a reason of at least 10 characters.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, ['super_admin']);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    const target = await db.prepare("SELECT id FROM users WHERE id = ? AND status != 'deleted' LIMIT 1")
      .bind(id).first();
    if (!target) return json({ error: 'Account not found.' }, { status: 404 });
    const key = `admin:${parsed.data.requestId}`;
    const prior = await db.prepare('SELECT user_id FROM entitlement_ledger WHERE idempotency_key = ? LIMIT 1')
      .bind(key).first<{ user_id: string }>();
    if (prior) return prior.user_id === id ? json({ ok: true, duplicate: true }) : json({ error: 'Request ID was already used.' }, { status: 409 });
    const now = Date.now();
    const column = parsed.data.kind === 'super_spike' ? 'super_spikes' : 'profile_lifts';
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO entitlement_wallets (user_id, super_spikes, profile_lifts, weekly_lift_available, version, created_at, updated_at) VALUES (?, 0, 0, 0, 0, ?, ?)').bind(id, now, now),
      db.prepare(`UPDATE entitlement_wallets SET ${column} = ${column} + ?, version = version + 1, updated_at = ? WHERE user_id = ?`).bind(parsed.data.amount, now, id),
      db.prepare('INSERT INTO entitlement_ledger (id, user_id, kind, delta, reason, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(identifier('led'), id, parsed.data.kind, parsed.data.amount, `admin grant: ${parsed.data.reason}`, key, now, now),
      db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(identifier('aud'), admin.user.id, 'admin.credit.grant', 'user', id, JSON.stringify({ kind: parsed.data.kind, amount: parsed.data.amount, reason: parsed.data.reason, requestId: parsed.data.requestId }), now),
    ]);
    const wallet = await db.prepare('SELECT super_spikes, profile_lifts FROM entitlement_wallets WHERE user_id = ?').bind(id).first();
    return json({ ok: true, wallet });
  });
}
