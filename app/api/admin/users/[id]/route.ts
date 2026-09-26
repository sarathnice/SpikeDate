import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(['suspend', 'restore']), note: z.string().trim().min(10).max(1000) });

export async function PATCH(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: 'Choose an action and write a reason of at least 10 characters.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, ['super_admin']);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    if (id === admin.user.id) return json({ error: 'You cannot change your own account.' }, { status: 400 });
    const target = await db.prepare('SELECT id, status FROM users WHERE id = ? LIMIT 1')
      .bind(id).first<{ id: string; status: string }>();
    if (!target) return json({ error: 'Account not found.' }, { status: 404 });
    const otherAdmin = await db.prepare('SELECT 1 AS present FROM admin_users WHERE user_id = ? LIMIT 1')
      .bind(id).first();
    if (otherAdmin) return json({ error: 'Admin accounts require a separate access review.' }, { status: 403 });
    const next = parsed.data.action === 'suspend' ? 'suspended' : 'active';
    if (target.status === next) return json({ error: `Account is already ${next}.` }, { status: 409 });
    if (parsed.data.action === 'suspend' && target.status !== 'active' ||
        parsed.data.action === 'restore' && target.status !== 'suspended')
      return json({ error: 'This transition is not available for the account.' }, { status: 409 });
    if (parsed.data.action === 'restore') {
      const activeSuspension = await db.prepare(
        "SELECT 1 AS present FROM safety_actions WHERE subject_id = ? AND kind = 'report' AND status = 'suspended' LIMIT 1",
      ).bind(id).first();
      if (activeSuspension)
        return json({ error: 'Resolve or overturn the suspended report before restoring this account.' }, { status: 409 });
    }
    const now = Date.now();
    await db.batch([
      db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
        .bind(next, now, id, target.status),
      db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(identifier('aud'), admin.user.id, `admin.user.${parsed.data.action}`, 'user', id,
          JSON.stringify({ status: target.status }), JSON.stringify({ status: next, note: parsed.data.note }), now),
    ]);
    return json({ user: { id, status: next } });
  });
}
