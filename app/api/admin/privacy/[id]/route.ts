import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ note: z.string().trim().min(10).max(1000) });

export async function PATCH(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: 'Add a processing note of at least 10 characters.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, ['super_admin', 'support_agent']);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    const item = await db.prepare('SELECT id, status FROM data_requests WHERE id = ? LIMIT 1')
      .bind(id).first<{ id: string; status: string }>();
    if (!item) return json({ error: 'Privacy request not found.' }, { status: 404 });
    if (item.status !== 'requested') return json({ error: 'This request is already in progress or closed.' }, { status: 409 });
    const now = Date.now();
    await db.batch([
      db.prepare("UPDATE data_requests SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'requested'")
        .bind(now, id),
      db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(identifier('aud'), admin.user.id, 'privacy.claim', 'data_request', id,
          JSON.stringify({ status: 'requested' }), JSON.stringify({ status: 'processing', note: parsed.data.note }), now),
    ]);
    return json({ request: { id, status: 'processing' } });
  });
}
