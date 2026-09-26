import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ outcome: z.enum(['upheld', 'overturned']), note: z.string().trim().min(10).max(1000) });

export async function PATCH(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: 'Choose a decision and add a note of at least 10 characters.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, parsed.data.outcome === 'overturned'
      ? ['super_admin'] : ['super_admin', 'safety_reviewer', 'moderator']);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    const appeal = await db.prepare(
      'SELECT moderation_appeals.id, moderation_appeals.user_id, moderation_appeals.safety_action_id, ' +
      'moderation_appeals.status ' +
      'FROM moderation_appeals JOIN safety_actions ON safety_actions.id = moderation_appeals.safety_action_id ' +
      'WHERE moderation_appeals.id = ? LIMIT 1',
    ).bind(id).first<{ id: string; user_id: string; safety_action_id: string; status: string }>();
    if (!appeal) return json({ error: 'Appeal not found.' }, { status: 404 });
    if (appeal.status !== 'open') return json({ error: 'Appeal already reviewed.' }, { status: 409 });
    const now = Date.now();
    const statements = [
      db.prepare('UPDATE moderation_appeals SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = ?')
        .bind(parsed.data.outcome, admin.user.id, now, now, id, 'open'),
      db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(identifier('aud'), admin.user.id, 'moderation.appeal', 'moderation_appeal', id,
          JSON.stringify({ outcome: parsed.data.outcome, note: parsed.data.note }), now),
    ];
    if (parsed.data.outcome === 'overturned') {
      statements.push(db.prepare("UPDATE safety_actions SET status = 'overturned', updated_at = ? WHERE id = ?")
        .bind(now, appeal.safety_action_id));
    }
    await db.batch(statements);
    // Restoring an account is a separate super-admin decision. Other open
    // reports or an independent suspension may still apply.
    return json({ appeal: { id, status: parsed.data.outcome } });
  });
}
