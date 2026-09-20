import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';
import { notifyUser } from '@/lib/server/notifications';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const result = await db
      .prepare(
        "UPDATE galaxy_plans SET status = 'cancelled', updated_at = ? " +
          "WHERE id = ? AND creator_id = ? AND status IN ('sent', 'accepted')",
      )
      .bind(Date.now(), id, user.id)
      .run();
    if (!Number(result.meta.changes ?? 0))
      return json({ error: 'Active plan not found.' }, { status: 404 });
    const invite = await db
      .prepare(
        'SELECT invitee_id FROM galaxy_plan_invites WHERE plan_id = ? LIMIT 1',
      )
      .bind(id)
      .first<{ invitee_id: string }>();
    if (invite)
      await notifyUser(db, {
        userId: invite.invitee_id,
        type: 'plan_update',
        title: 'Date plan cancelled',
        body: 'Your match cancelled a date plan.',
        data: { url: '/?tab=Galaxy', planId: id },
      });
    return json({ plan: { id, status: 'cancelled' } });
  });
}
