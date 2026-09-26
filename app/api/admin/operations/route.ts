import { requireAdmin, type AdminRole } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

const allowed: Record<string, readonly AdminRole[]> = {
  users: ['super_admin', 'safety_reviewer', 'moderator', 'support_agent', 'billing_analyst'],
  privacy: ['super_admin', 'support_agent'],
  audit: ['super_admin'],
  appeals: ['super_admin', 'safety_reviewer', 'moderator'],
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get('view') ?? '';
  if (!allowed[view]) return json({ error: 'Unknown operations view.' }, { status: 400 });

  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, allowed[view]);
    if (admin instanceof Response) return admin;
    if (view === 'users') {
      const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
      const status = url.searchParams.get('status') ?? 'all';
      const verification = url.searchParams.get('verification') ?? 'all';
      if (!['all', 'active', 'suspended'].includes(status) || !['all', 'verified', 'unverified'].includes(verification)) {
        return json({ error: 'Unknown people filter.' }, { status: 400 });
      }
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 100000) {
        return json({ error: 'Invalid page.' }, { status: 400 });
      }
      const pageSize = 25;
      const where = 'FROM users LEFT JOIN profiles ON profiles.user_id = users.id ' +
        'WHERE (? = \'\' OR users.email LIKE ? OR profiles.display_name LIKE ? OR users.phone_number LIKE ? OR users.id = ?) ' +
        'AND (? = \'all\' OR users.status = ?) ' +
        "AND (? = 'all' OR (? = 'verified' AND profiles.verification_status IN ('verified', 'photo_verified')) " +
        "OR (? = 'unverified' AND (profiles.verification_status IS NULL OR profiles.verification_status NOT IN ('verified', 'photo_verified')))) ";
      const bindFilters = [query, `%${query}%`, `%${query}%`, `%${query}%`, query, status, status, verification, verification, verification];
      const reportsColumn = admin.roles.some((role) => ['super_admin', 'safety_reviewer', 'moderator'].includes(role))
        ? "(SELECT COUNT(*) FROM safety_actions WHERE subject_id = users.id AND kind = 'report') AS reports "
        : 'NULL AS reports ';
      const count = await db.prepare('SELECT COUNT(*) AS count ' + where).bind(...bindFilters).first<{ count: number }>();
      const total = Number(count?.count ?? 0);
      const allCount = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
      const pages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(requestedPage, pages);
      const result = await db.prepare(
        'SELECT users.id, users.email, users.phone_number, users.status, users.created_at, users.last_active_at, ' +
        'profiles.display_name, profiles.city, profiles.region, profiles.verification_status, ' +
        reportsColumn +
        where + 'ORDER BY users.created_at DESC, users.id DESC LIMIT ? OFFSET ?',
      ).bind(...bindFilters, pageSize, (page - 1) * pageSize).all();
      return json({ view, rows: result.results, total, allTotal: Number(allCount?.count ?? 0), page, pageSize, pages }, { headers: { 'cache-control': 'no-store' } });
    }
    if (view === 'privacy') {
      const result = await db.prepare(
        'SELECT data_requests.id, data_requests.kind, data_requests.status, data_requests.due_at, ' +
        'data_requests.created_at, users.email, profiles.display_name ' +
        'FROM data_requests JOIN users ON users.id = data_requests.user_id ' +
        'LEFT JOIN profiles ON profiles.user_id = users.id ' +
        'ORDER BY CASE WHEN data_requests.status IN (\'requested\', \'processing\') THEN 0 ELSE 1 END, ' +
        'data_requests.due_at ASC LIMIT 50',
      ).all();
      return json({ view, rows: result.results }, { headers: { 'cache-control': 'no-store' } });
    }
    if (view === 'appeals') {
      const result = await db.prepare(
        'SELECT moderation_appeals.id, moderation_appeals.statement, moderation_appeals.status, ' +
        'moderation_appeals.created_at, users.email, profiles.display_name, ' +
        'safety_actions.reason, safety_actions.status AS action_status ' +
        'FROM moderation_appeals JOIN users ON users.id = moderation_appeals.user_id ' +
        'LEFT JOIN profiles ON profiles.user_id = users.id ' +
        'JOIN safety_actions ON safety_actions.id = moderation_appeals.safety_action_id ' +
        'ORDER BY CASE WHEN moderation_appeals.status = \'open\' THEN 0 ELSE 1 END, ' +
        'moderation_appeals.created_at ASC LIMIT 50',
      ).all();
      return json({ view, rows: result.results }, { headers: { 'cache-control': 'no-store' } });
    }
    const result = await db.prepare(
      'SELECT audit_logs.id, audit_logs.action, audit_logs.entity_type, audit_logs.entity_id, ' +
      'audit_logs.created_at, users.email AS actor_email ' +
      'FROM audit_logs LEFT JOIN users ON users.id = audit_logs.actor_id ' +
      'ORDER BY audit_logs.created_at DESC LIMIT 50',
    ).all();
    return json({ view, rows: result.results }, { headers: { 'cache-control': 'no-store' } });
  });
}
