import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { notifySupportEmail } from '@/lib/server/support-email';

export const runtime = 'edge';
const roles = ['super_admin', 'support_agent'] as const;
const actionSchema = z.object({ threadId: z.string().max(80), action: z.enum(['reply', 'resolve', 'reopen']), message: z.string().trim().max(2000).optional() });

export async function GET(request: Request) {
  return withDatabase(async (db) => {
    const admin = await requireAdmin(request, db, roles);
    if (admin instanceof Response) return admin;
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const thread = await db.prepare('SELECT st.id, st.category, st.subject, st.status, st.created_at, st.updated_at, u.email, p.display_name FROM support_threads st JOIN users u ON u.id = st.user_id LEFT JOIN profiles p ON p.user_id = u.id WHERE st.id = ? AND st.status != ?').bind(id, 'self_service').first();
      if (!thread) return json({ error: 'Support request not found.' }, { status: 404 });
      const messages = await db.prepare('SELECT id, sender, body, created_at FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 100').bind(id).all();
      return json({ thread, messages: messages.results });
    }
    const rows = await db.prepare("SELECT st.id, st.category, st.subject, st.status, st.created_at, st.updated_at, u.email, p.display_name FROM support_threads st JOIN users u ON u.id = st.user_id LEFT JOIN profiles p ON p.user_id = u.id WHERE st.status != 'self_service' ORDER BY CASE st.status WHEN 'open' THEN 0 WHEN 'waiting_user' THEN 1 ELSE 2 END, st.updated_at DESC LIMIT 100").all();
    return json({ rows: rows.results });
  });
}

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success || (parsed.data?.action === 'reply' && !parsed.data.message?.trim())) return json({ error: 'Enter a reply or choose a status action.' }, { status: 400 });
  return withDatabase(async (db) => {
    const admin = await requireAdmin(request, db, roles);
    if (admin instanceof Response) return admin;
    const thread = await db.prepare("SELECT id, status FROM support_threads WHERE id = ? AND status != 'self_service'").bind(parsed.data.threadId).first<{ id: string; status: string }>();
    if (!thread) return json({ error: 'Support request not found.' }, { status: 404 });
    const now = Date.now();
    const status = parsed.data.action === 'reply' ? 'waiting_user' : parsed.data.action === 'resolve' ? 'resolved' : 'open';
    const statements = [
      db.prepare('UPDATE support_threads SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, thread.id),
      db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(identifier('aud'), admin.user.id, `support.${parsed.data.action}`, 'support_thread', thread.id, JSON.stringify({ from: thread.status, to: status }), now),
    ];
    if (parsed.data.action === 'reply') statements.push(db.prepare('INSERT INTO support_messages (id, thread_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(identifier('sm'), thread.id, 'admin', parsed.data.message, now));
    await db.batch(statements);
    if (parsed.data.action === 'reply') {
      const member = await db.prepare('SELECT users.email FROM support_threads JOIN users ON users.id = support_threads.user_id WHERE support_threads.id = ?').bind(thread.id).first<{ email: string }>();
      try { await notifySupportEmail('reply', thread.id, member?.email); } catch (error) { console.error('Support reply notification failed', error); }
    }
    return json({ status });
  });
}
