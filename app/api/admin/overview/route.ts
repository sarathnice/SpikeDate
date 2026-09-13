import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db);
    if (admin instanceof Response) return admin;
    const now = Date.now();
    const [
      users,
      reports,
      moderation,
      subscriptions,
      lifts,
      messages,
      plans,
      privacy,
    ] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'active'")
        .first(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM safety_actions WHERE kind = 'report' AND status = 'open'",
        )
        .first(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM profile_media WHERE moderation_status = 'pending'",
        )
        .first(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM subscriptions WHERE status = 'active'",
        )
        .first(),
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM profile_lift_activations WHERE ends_at > ?',
        )
        .bind(now)
        .first(),
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM messages WHERE created_at > ? AND deleted_at IS NULL',
        )
        .bind(now - 24 * 60 * 60 * 1000)
        .first(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM galaxy_plans WHERE status IN ('sent', 'accepted') AND starts_at > ?",
        )
        .bind(now)
        .first(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM data_requests WHERE status IN ('requested', 'processing')",
        )
        .first(),
    ]);
    const openCases = await db
      .prepare(
        'SELECT safety_actions.id, safety_actions.reason, safety_actions.details, safety_actions.created_at, ' +
          'reporter.display_name AS reporter_name, subject.display_name AS subject_name ' +
          'FROM safety_actions JOIN profiles reporter ON reporter.user_id = safety_actions.reporter_id ' +
          'JOIN profiles subject ON subject.user_id = safety_actions.subject_id ' +
          "WHERE safety_actions.kind = 'report' AND safety_actions.status = 'open' " +
          'ORDER BY safety_actions.created_at ASC LIMIT 20',
      )
      .all();
    return json({
      admin: { email: admin.user.email, roles: admin.roles },
      metrics: {
        activeUsers: Number((users as { count?: number } | null)?.count ?? 0),
        openReports: Number((reports as { count?: number } | null)?.count ?? 0),
        pendingMedia: Number(
          (moderation as { count?: number } | null)?.count ?? 0,
        ),
        activeSubscriptions: Number(
          (subscriptions as { count?: number } | null)?.count ?? 0,
        ),
        activeLifts: Number((lifts as { count?: number } | null)?.count ?? 0),
        messages24h: Number(
          (messages as { count?: number } | null)?.count ?? 0,
        ),
        upcomingPlans: Number((plans as { count?: number } | null)?.count ?? 0),
        privacyRequests: Number(
          (privacy as { count?: number } | null)?.count ?? 0,
        ),
      },
      openCases: openCases.results,
    });
  });
}
