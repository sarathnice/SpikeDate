import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';

export const runtime = 'edge';

const schema = z.object({
  newLikes: z.boolean(),
  newMatches: z.boolean(),
  messages: z.boolean(),
  planUpdates: z.boolean(),
  activityBriefing: z.boolean(),
  quietHours: z
    .object({
      start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      timeZone: z.string().trim().min(1).max(80).optional(),
    })
    .nullable(),
});

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const row = await db
      .prepare(
        'SELECT new_likes, new_matches, messages, plan_updates, activity_briefing, quiet_hours_json ' +
          'FROM notification_preferences WHERE user_id = ? LIMIT 1',
      )
      .bind(user.id)
      .first<{
        new_likes: number;
        new_matches: number;
        messages: number;
        plan_updates: number;
        activity_briefing: number;
        quiet_hours_json: string;
      }>();
    return json({
      preferences: row
        ? {
            newLikes: Boolean(row.new_likes),
            newMatches: Boolean(row.new_matches),
            messages: Boolean(row.messages),
            planUpdates: Boolean(row.plan_updates),
            activityBriefing: Boolean(row.activity_briefing),
            quietHours: JSON.parse(row.quiet_hours_json || 'null'),
          }
        : {
            newLikes: true,
            newMatches: true,
            messages: true,
            planUpdates: true,
            activityBriefing: false,
            quietHours: null,
          },
    });
  });
}

export async function PATCH(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Notification preferences are invalid.' },
      { status: 400 },
    );
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    await db
      .prepare(
        'INSERT INTO notification_preferences ' +
          '(user_id, new_likes, new_matches, messages, plan_updates, activity_briefing, quiet_hours_json, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(user_id) DO UPDATE SET new_likes = excluded.new_likes, new_matches = excluded.new_matches, ' +
          'messages = excluded.messages, plan_updates = excluded.plan_updates, activity_briefing = excluded.activity_briefing, ' +
          'quiet_hours_json = excluded.quiet_hours_json, updated_at = excluded.updated_at',
      )
      .bind(
        user.id,
        Number(parsed.data.newLikes),
        Number(parsed.data.newMatches),
        Number(parsed.data.messages),
        Number(parsed.data.planUpdates),
        Number(parsed.data.activityBriefing),
        JSON.stringify(parsed.data.quietHours),
        now,
        now,
      )
      .run();
    return json({ ok: true, preferences: parsed.data });
  });
}
