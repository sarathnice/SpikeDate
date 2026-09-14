import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

type Candidate = {
  user_id: string;
  display_name: string;
  birth_date: string;
  gender: string;
  bio: string;
  city: string | null;
  relationship_goal: string;
  verification_status: string;
  lift_ends_at: number | null;
  shared_interests: number;
  daily_text: string | null;
  available_tonight: number | null;
  availability_local_date: string | null;
  availability_start_at: number | null;
  availability_end_at: number | null;
  availability_timezone: string | null;
  primary_media_id: string | null;
  last_active_at: number | null;
};

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const url = new URL(request.url);
    const limit = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get('limit')) || 20),
    );
    const preferences = await db
      .prepare(
        'SELECT min_age, max_age, max_distance_km, genders_json, relationship_goals_json FROM preferences WHERE user_id = ?',
      )
      .bind(user.id)
      .first<{
        min_age: number;
        max_age: number;
        max_distance_km: number;
        genders_json: string;
        relationship_goals_json: string;
      }>();
    const genders = preferences ? JSON.parse(preferences.genders_json) : [];
    const goals = preferences
      ? JSON.parse(preferences.relationship_goals_json)
      : [];
    const result = await db
      .prepare(
        'SELECT profiles.user_id, profiles.display_name, users.birth_date, profiles.bio, profiles.city, profiles.gender, ' +
          'profiles.relationship_goal, profiles.verification_status, users.last_active_at, lifts.ends_at AS lift_ends_at, ' +
          'COUNT(DISTINCT shared.interest_id) AS shared_interests, updates.text AS daily_text, ' +
          'updates.available_tonight AS available_tonight, ' +
          'availability.local_date AS availability_local_date, availability.start_at AS availability_start_at, ' +
          'availability.end_at AS availability_end_at, availability.timezone AS availability_timezone, ' +
          "(SELECT media.id FROM profile_media media WHERE media.user_id = profiles.user_id AND media.type = 'photo' " +
          "AND media.moderation_status = 'approved' ORDER BY media.position LIMIT 1) AS primary_media_id " +
          'FROM profiles JOIN users ON users.id = profiles.user_id ' +
          'LEFT JOIN user_interests shared ON shared.user_id = profiles.user_id AND shared.interest_id IN ' +
          '(SELECT interest_id FROM user_interests WHERE user_id = ?) ' +
          'LEFT JOIN profile_lift_activations lifts ON lifts.user_id = profiles.user_id AND lifts.ends_at > ? ' +
          'LEFT JOIN daily_updates updates ON updates.user_id = profiles.user_id AND updates.expires_at > ? AND updates.deleted_at IS NULL ' +
          'LEFT JOIN daily_availability availability ON availability.user_id = profiles.user_id AND availability.end_at > ? ' +
          "WHERE profiles.user_id != ? AND profiles.discoverable = 1 AND users.status = 'active' " +
          'AND NOT EXISTS (SELECT 1 FROM safety_actions blocked WHERE blocked.kind = ? AND ' +
          '((blocked.reporter_id = ? AND blocked.subject_id = profiles.user_id) OR ' +
          '(blocked.reporter_id = profiles.user_id AND blocked.subject_id = ?))) ' +
          'AND NOT EXISTS (SELECT 1 FROM interactions seen WHERE seen.actor_id = ? AND seen.target_id = profiles.user_id ' +
          "AND seen.kind IN ('like', 'super_spike', 'pass') AND seen.undone_at IS NULL) " +
          'GROUP BY profiles.user_id ' +
          'ORDER BY (lifts.ends_at IS NOT NULL) DESC, shared_interests DESC, users.last_active_at DESC, profiles.user_id ' +
          'LIMIT ?',
      )
      .bind(
        user.id,
        Date.now(),
        Date.now(),
        Date.now(),
        user.id,
        'block',
        user.id,
        user.id,
        user.id,
        limit,
      )
      .all<Candidate>();
    const now = new Date();
    const profiles = result.results.flatMap((candidate) => {
      const birthDate = new Date(candidate.birth_date + 'T00:00:00Z');
      let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
      if (
        now.getUTCMonth() < birthDate.getUTCMonth() ||
        (now.getUTCMonth() === birthDate.getUTCMonth() &&
          now.getUTCDate() < birthDate.getUTCDate())
      )
        age -= 1;
      if (
        preferences &&
        (age < preferences.min_age || age > preferences.max_age)
      )
        return [];
      if (genders.length && !genders.includes(candidate.gender)) return [];
      if (goals.length && !goals.includes(candidate.relationship_goal))
        return [];
      const reasons: string[] = [];
      if (candidate.shared_interests)
        reasons.push(
          candidate.shared_interests +
            ' shared ' +
            (candidate.shared_interests === 1 ? 'interest' : 'interests'),
        );
      if (goals.includes(candidate.relationship_goal))
        reasons.push('same relationship goal');
      const verified = [
        'verified',
        'photo_verified',
        'identity_verified',
      ].includes(candidate.verification_status);
      if (verified) reasons.push('verified profile');
      return [
        {
          id: candidate.user_id,
          name: candidate.display_name,
          age,
          gender: candidate.gender,
          bio: candidate.bio,
          city: candidate.city,
          relationshipGoal: candidate.relationship_goal,
          verified,
          active: Boolean(
            candidate.last_active_at &&
            candidate.last_active_at >= Date.now() - 15 * 60 * 1000,
          ),
          profileLiftActive: Boolean(candidate.lift_ends_at),
          today: candidate.daily_text,
          availableTonight: Boolean(candidate.available_tonight),
          availability:
            candidate.availability_local_date &&
            candidate.availability_start_at &&
            candidate.availability_end_at &&
            candidate.availability_timezone
              ? {
                  localDate: candidate.availability_local_date,
                  startAt: new Date(
                    candidate.availability_start_at,
                  ).toISOString(),
                  endAt: new Date(candidate.availability_end_at).toISOString(),
                  timezone: candidate.availability_timezone,
                }
              : null,
          imageUrl: candidate.primary_media_id
            ? '/api/media/' + candidate.primary_media_id + '?variant=card'
            : null,
          whyFit: reasons.slice(0, 3),
        },
      ];
    });
    return json({ profiles, count: profiles.length });
  });
}
