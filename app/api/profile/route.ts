import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import {
  getProfileReadiness,
  reconcileDiscoverability,
} from '@/lib/server/profile-readiness';

export const runtime = 'edge';

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  bio: z.string().trim().max(500),
  pronouns: z.string().trim().max(40).nullable(),
  occupation: z.string().trim().max(80).nullable(),
  education: z.string().trim().max(100).nullable(),
  heightCm: z.number().int().min(120).max(230).nullable(),
  ethnicity: z.string().trim().max(80).nullable(),
  relationshipGoal: z.string().trim().min(2).max(80),
  kids: z.string().trim().max(50).nullable(),
  wantsKids: z.string().trim().max(50).nullable(),
  drinking: z.string().trim().max(50).nullable(),
  smoking: z.string().trim().max(50).nullable(),
  pets: z.string().trim().max(50).nullable(),
  city: z.string().trim().max(100).nullable(),
  country: z.string().trim().max(100).nullable(),
  discoverable: z.boolean(),
});

const preferencesSchema = z.object({
  genders: z.array(z.string().trim().min(1).max(40)).max(10),
  minAge: z.number().int().min(18).max(99),
  maxAge: z.number().int().min(18).max(99),
  maxDistanceKm: z.number().int().min(1).max(500),
  relationshipGoals: z.array(z.string().trim().min(1).max(80)).max(10),
  dealbreakers: z.array(z.string().trim().min(1).max(80)).max(20),
});

const schema = z.discriminatedUnion('section', [
  z.object({ section: z.literal('profile'), data: profileSchema.partial() }),
  z.object({ section: z.literal('preferences'), data: preferencesSchema }),
  z.object({
    section: z.literal('prompts'),
    data: z
      .array(
        z.object({
          prompt: z.string().trim().min(2).max(120),
          answer: z.string().trim().min(2).max(500),
        }),
      )
      .max(6),
  }),
  z.object({
    section: z.literal('interests'),
    data: z.array(z.string().trim().min(1).max(50)).max(20),
  }),
]);

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const [
      profile,
      preferences,
      prompts,
      interests,
      media,
      update,
      wallet,
      subscription,
      availability,
    ] = await Promise.all([
      db
        .prepare('SELECT * FROM profiles WHERE user_id = ?')
        .bind(user.id)
        .first(),
      db
        .prepare('SELECT * FROM preferences WHERE user_id = ?')
        .bind(user.id)
        .first(),
      db
        .prepare(
          'SELECT id, prompt, answer, position FROM profile_prompts WHERE user_id = ? ORDER BY position',
        )
        .bind(user.id)
        .all(),
      db
        .prepare(
          'SELECT interests.label FROM user_interests JOIN interests ON interests.id = user_interests.interest_id WHERE user_interests.user_id = ? ORDER BY interests.label',
        )
        .bind(user.id)
        .all(),
      db
        .prepare(
          'SELECT id, type, position, moderation_status, explicit FROM profile_media WHERE user_id = ? ORDER BY position',
        )
        .bind(user.id)
        .all(),
      db
        .prepare(
          'SELECT id, text, visibility, available_tonight, expires_at FROM daily_updates WHERE user_id = ? AND expires_at > ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
        )
        .bind(user.id, Date.now())
        .first(),
      db
        .prepare(
          'SELECT super_spikes, profile_lifts, weekly_lift_available FROM entitlement_wallets WHERE user_id = ?',
        )
        .bind(user.id)
        .first(),
      db
        .prepare(
          "SELECT plan, status, current_period_ends_at FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY current_period_ends_at DESC LIMIT 1",
        )
        .bind(user.id)
        .first(),
      db
        .prepare(
          'SELECT local_date, start_at, end_at, timezone FROM daily_availability WHERE user_id = ? AND end_at > ?',
        )
        .bind(user.id, Date.now())
        .first<{
          local_date: string;
          start_at: number;
          end_at: number;
          timezone: string;
        }>(),
    ]);
    const readiness = await getProfileReadiness(db, user.id);
    return json({
      user,
      profile,
      preferences,
      prompts: prompts.results,
      interests: interests.results,
      media: media.results.map((item) => ({
        ...item,
        url: '/api/media/' + (item as { id: string }).id,
      })),
      dailyUpdate: update,
      wallet,
      subscription,
      availability: availability
        ? {
            localDate: availability.local_date,
            startAt: new Date(availability.start_at).toISOString(),
            endAt: new Date(availability.end_at).toISOString(),
            timezone: availability.timezone,
          }
        : null,
      readiness,
    });
  });
}

export async function PATCH(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Review this profile section.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    if (parsed.data.section === 'profile') {
      const entries = Object.entries(parsed.data.data);
      if (!entries.length) return json({ ok: true });
      const columns: Record<string, string> = {
        displayName: 'display_name',
        bio: 'bio',
        pronouns: 'pronouns',
        occupation: 'occupation',
        education: 'education',
        heightCm: 'height_cm',
        ethnicity: 'ethnicity',
        relationshipGoal: 'relationship_goal',
        kids: 'kids',
        wantsKids: 'wants_kids',
        drinking: 'drinking',
        smoking: 'smoking',
        pets: 'pets',
        city: 'city',
        country: 'country',
        discoverable: 'discoverable_requested',
      };
      const assignments = entries.map(([key]) => columns[key] + ' = ?');
      await db
        .prepare(
          'UPDATE profiles SET ' +
            assignments.join(', ') +
            ', completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE user_id = ?',
        )
        .bind(...entries.map(([, value]) => value), now, now, user.id)
        .run();
    } else if (parsed.data.section === 'preferences') {
      if (parsed.data.data.minAge > parsed.data.data.maxAge)
        return json(
          { error: 'Minimum age must not exceed maximum age.' },
          { status: 400 },
        );
      await db
        .prepare(
          'UPDATE preferences SET genders_json = ?, min_age = ?, max_age = ?, max_distance_km = ?, ' +
            'relationship_goals_json = ?, dealbreakers_json = ?, updated_at = ? WHERE user_id = ?',
        )
        .bind(
          JSON.stringify(parsed.data.data.genders),
          parsed.data.data.minAge,
          parsed.data.data.maxAge,
          parsed.data.data.maxDistanceKm,
          JSON.stringify(parsed.data.data.relationshipGoals),
          JSON.stringify(parsed.data.data.dealbreakers),
          now,
          user.id,
        )
        .run();
    } else if (parsed.data.section === 'prompts') {
      const existing = await db
        .prepare('SELECT id FROM profile_prompts WHERE user_id = ?')
        .bind(user.id)
        .all<{ id: string }>();
      await db.batch([
        ...existing.results.map((item) =>
          db.prepare('DELETE FROM profile_prompts WHERE id = ?').bind(item.id),
        ),
        ...parsed.data.data.map((item, position) =>
          db
            .prepare(
              'INSERT INTO profile_prompts (id, user_id, prompt, answer, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              crypto.randomUUID(),
              user.id,
              item.prompt,
              item.answer,
              position,
              now,
              now,
            ),
        ),
      ]);
    } else {
      const existing = await db
        .prepare('SELECT interest_id FROM user_interests WHERE user_id = ?')
        .bind(user.id)
        .all<{ interest_id: string }>();
      const labels = parsed.data.data;
      const interestRows = await Promise.all(
        labels.map(async (label) => {
          const current = await db
            .prepare('SELECT id FROM interests WHERE label = ? LIMIT 1')
            .bind(label)
            .first<{ id: string }>();
          return {
            id: current?.id ?? 'interest_' + crypto.randomUUID(),
            label,
            exists: !!current,
          };
        }),
      );
      await db.batch([
        ...existing.results.map((item) =>
          db
            .prepare(
              'DELETE FROM user_interests WHERE user_id = ? AND interest_id = ?',
            )
            .bind(user.id, item.interest_id),
        ),
        ...interestRows.flatMap((item) => [
          ...(item.exists
            ? []
            : [
                db
                  .prepare(
                    'INSERT INTO interests (id, label, category) VALUES (?, ?, ?)',
                  )
                  .bind(item.id, item.label, 'user'),
              ]),
          db
            .prepare(
              'INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)',
            )
            .bind(user.id, item.id),
        ]),
      ]);
    }
    const readiness = await reconcileDiscoverability(db, user.id);
    return json({ ok: true, section: parsed.data.section, readiness });
  });
}
