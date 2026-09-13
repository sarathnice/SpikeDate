import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  activity: z.string().trim().min(2).max(50),
  venue: z.object({
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().min(3).max(240),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  startsAt: z.number().int().positive(),
  inviteeIds: z.array(z.string().min(5).max(80)).min(1).max(10),
});

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const result = await db
      .prepare(
        'SELECT DISTINCT galaxy_plans.* FROM galaxy_plans ' +
          'LEFT JOIN galaxy_plan_invites ON galaxy_plan_invites.plan_id = galaxy_plans.id ' +
          'WHERE galaxy_plans.creator_id = ? OR galaxy_plan_invites.invitee_id = ? ' +
          'ORDER BY galaxy_plans.starts_at ASC',
      )
      .bind(user.id, user.id)
      .all();
    return json({ plans: result.results });
  });
}

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Complete the plan, venue, date, and invitees.' },
      { status: 400 },
    );
  if (parsed.data.startsAt < Date.now() + 15 * 60 * 1000)
    return json(
      { error: 'Choose a time at least 15 minutes from now.' },
      { status: 400 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const invitees = [...new Set(parsed.data.inviteeIds)].filter(
      (id) => id !== user.id,
    );
    const allowed = await db
      .prepare(
        'SELECT CASE WHEN user_a_id = ? THEN user_b_id ELSE user_a_id END AS user_id ' +
          "FROM matches WHERE status = 'active' AND (user_a_id = ? OR user_b_id = ?)",
      )
      .bind(user.id, user.id, user.id)
      .all<{ user_id: string }>();
    const allowedIds = new Set(allowed.results.map((row) => row.user_id));
    if (!invitees.length || invitees.some((id) => !allowedIds.has(id)))
      return json(
        { error: 'Plans can only invite active matches.' },
        { status: 403 },
      );

    const now = Date.now();
    const planId = identifier('plan');
    await db.batch([
      db
        .prepare(
          'INSERT INTO galaxy_plans ' +
            '(id, creator_id, name, activity, venue_name, venue_address, latitude_e6, longitude_e6, starts_at, status, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          planId,
          user.id,
          parsed.data.name,
          parsed.data.activity,
          parsed.data.venue.name,
          parsed.data.venue.address,
          parsed.data.venue.latitude == null
            ? null
            : Math.round(parsed.data.venue.latitude * 1_000_000),
          parsed.data.venue.longitude == null
            ? null
            : Math.round(parsed.data.venue.longitude * 1_000_000),
          parsed.data.startsAt,
          'sent',
          now,
          now,
        ),
      ...invitees.map((inviteeId) =>
        db
          .prepare(
            'INSERT INTO galaxy_plan_invites ' +
              '(plan_id, invitee_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(planId, inviteeId, 'pending', now, now),
      ),
    ]);
    return json({ plan: { id: planId, status: 'sent' } }, { status: 201 });
  });
}
