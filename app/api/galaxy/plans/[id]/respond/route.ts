import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import { notifyUser } from '@/lib/server/notifications';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  response: z.enum(['accepted', 'declined', 'alternate']),
});

export async function POST(request: Request, context: Context) {
  if (process.env.SPIKEDATE_DATE_PLANS_ENABLED === 'false')
    return json({ error: 'Date planning is unavailable.' }, { status: 404 });
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Choose accept, decline, or propose another time.' },
      { status: 400 },
    );
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const now = Date.now();
    const result = await db
      .prepare(
        'UPDATE galaxy_plan_invites SET status = ?, responded_at = ?, updated_at = ? ' +
          "WHERE plan_id = ? AND invitee_id = ? AND status = 'pending'",
      )
      .bind(parsed.data.response, now, now, id, user.id)
      .run();
    if (!Number(result.meta.changes ?? 0))
      return json({ error: 'Pending invitation not found.' }, { status: 404 });
    if (parsed.data.response === 'accepted')
      await db
        .prepare(
          "UPDATE galaxy_plans SET status = 'accepted', updated_at = ? WHERE id = ?",
        )
        .bind(now, id)
        .run();
    const plan = await db
      .prepare('SELECT creator_id, name FROM galaxy_plans WHERE id = ? LIMIT 1')
      .bind(id)
      .first<{ creator_id: string; name: string }>();
    if (plan)
      await notifyUser(db, {
        userId: plan.creator_id,
        type: 'plan_update',
        title: `Plan ${parsed.data.response}`,
        body: `${plan.name} was ${parsed.data.response}.`,
        data: { url: '/?tab=Galaxy', planId: id },
      });
    return json({ invitation: { planId: id, status: parsed.data.response } });
  });
}
