import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ reason: z.string().trim().min(10).max(500) });

export async function POST(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: 'A case-access reason of at least 10 characters is required.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, ['super_admin', 'safety_reviewer']);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    const report = await db.prepare("SELECT id, reporter_id, subject_id, created_at FROM safety_actions WHERE id = ? AND kind = 'report' LIMIT 1")
      .bind(id).first<{ id: string; reporter_id: string; subject_id: string; created_at: number }>();
    if (!report) return json({ error: 'Report not found.' }, { status: 404 });
    const rows = await db.prepare(
      'SELECT messages.id, messages.sender_id, messages.body, messages.created_at, messages.delivered_at, messages.read_at, ' +
      'message_media.kind AS media_kind FROM messages JOIN conversations ON conversations.id = messages.conversation_id ' +
      'JOIN matches ON matches.id = conversations.match_id LEFT JOIN message_media ON message_media.message_id = messages.id ' +
      'WHERE messages.deleted_at IS NULL AND messages.created_at BETWEEN ? AND ? AND ((matches.user_a_id = ? AND matches.user_b_id = ?) OR (matches.user_a_id = ? AND matches.user_b_id = ?)) ' +
      'ORDER BY messages.created_at DESC LIMIT 100',
    ).bind(report.created_at - 30 * 86400000, report.created_at + 86400000, report.reporter_id, report.subject_id, report.subject_id, report.reporter_id).all();
    await db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(identifier('aud'), admin.user.id, 'admin.case.messages.view', 'safety_action', id,
        JSON.stringify({ reason: parsed.data.reason, count: rows.results.length }), Date.now()).run();
    return json({ reportId: id, participants: [report.reporter_id, report.subject_id], messages: rows.results.reverse() });
  });
}
