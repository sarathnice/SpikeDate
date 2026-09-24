import { requireUser } from '@/lib/server/auth';
import { connectionFromRow } from '@/lib/profile-connection';
import { isRecentlyActive } from '@/lib/presence';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';
import { zodiacFromBirthDate } from '@/lib/astrology';
import {
  matchesDiscoveryLocation,
  normalizeCity,
  type ViewerLocation,
} from '@/lib/discovery-location';

export const runtime = 'edge';

type Candidate = {
  relationship_style?: string;
  dating_pace?: string;
  communication_preference?: string;
  values_json?: string;
  rhythm_json?: string;
  languages_json?: string;
  education?: string;
  pets?: string;
  user_id: string;
  display_name: string;
  birth_date: string;
  gender: string;
  height_cm: number | null;
  occupation: string | null;
  kids: string | null;
  wants_kids: string | null;
  smoking: string | null;
  drinking: string | null;
  bio: string;
  city: string | null;
  region: string | null;
  discovery_city: string | null;
  latitude_e6: number | null;
  longitude_e6: number | null;
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
  show_online: number | null;
};

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const url = new URL(request.url);
    const includeMatches = url.searchParams.get('includeMatches') === '1';
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
    const locationRow = await db
      .prepare(
        'SELECT discovery_location_mode, discovery_city, latitude_e6, longitude_e6, discovery_location_updated_at FROM profiles WHERE user_id = ?',
      )
      .bind(user.id)
      .first<{
        discovery_location_mode: string;
        discovery_city: string | null;
        latitude_e6: number | null;
        longitude_e6: number | null;
        discovery_location_updated_at: number | null;
      }>();
    const location: ViewerLocation = {
      mode:
        locationRow?.discovery_location_mode === 'device' ||
        locationRow?.discovery_location_mode === 'city' ||
        locationRow?.discovery_location_mode === 'denied'
          ? locationRow.discovery_location_mode
          : 'unset',
      city: locationRow?.discovery_city ?? null,
      latitudeE6: locationRow?.latitude_e6 ?? null,
      longitudeE6: locationRow?.longitude_e6 ?? null,
      updatedAt: locationRow?.discovery_location_updated_at ?? null,
    };
    const genders: string[] = preferences
      ? (JSON.parse(preferences.genders_json) as string[]).map((gender) =>
          gender.toLowerCase(),
        )
      : [];
    const goals = preferences
      ? JSON.parse(preferences.relationship_goals_json)
      : [];
    const maxDistanceKm = preferences?.max_distance_km ?? 50;
    let locationSql = '';
    let locationParams: Array<string | number> = [];
    if (
      location.mode === 'device' &&
      location.latitudeE6 !== null &&
      location.longitudeE6 !== null
    ) {
      const latitude = location.latitudeE6 / 1_000_000;
      const longitude = location.longitudeE6 / 1_000_000;
      const latitudeSpan = maxDistanceKm / 110.574;
      const longitudeSpan =
        maxDistanceKm /
        Math.max(10, 111.32 * Math.abs(Math.cos((latitude * Math.PI) / 180)));
      locationSql =
        'AND profiles.latitude_e6 BETWEEN ? AND ? AND profiles.longitude_e6 BETWEEN ? AND ? ';
      locationParams = [
        Math.round((latitude - latitudeSpan) * 1_000_000),
        Math.round((latitude + latitudeSpan) * 1_000_000),
        Math.round((longitude - longitudeSpan) * 1_000_000),
        Math.round((longitude + longitudeSpan) * 1_000_000),
      ];
    } else if (location.mode === 'city' && location.city) {
      locationSql =
        'AND LOWER(TRIM(COALESCE(profiles.discovery_city, profiles.city))) = ? ';
      locationParams = [normalizeCity(location.city)];
    }
    const result = await db
      .prepare(
        'SELECT profiles.user_id, profiles.display_name, users.birth_date, profiles.bio, profiles.city, profiles.region, profiles.discovery_city, profiles.latitude_e6, profiles.longitude_e6, profiles.gender, ' +
          'profiles.height_cm, profiles.occupation, profiles.kids, profiles.wants_kids, profiles.smoking, profiles.drinking, profiles.education, profiles.pets, ' +
          'connections.relationship_style, connections.dating_pace, connections.communication_preference, connections.values_json, connections.rhythm_json, connections.languages_json, ' +
          'profiles.relationship_goal, profiles.verification_status, users.last_active_at, presence_pref.show_online, lifts.ends_at AS lift_ends_at, ' +
          'COUNT(DISTINCT shared.interest_id) AS shared_interests, updates.text AS daily_text, ' +
          'updates.available_tonight AS available_tonight, ' +
          'availability.local_date AS availability_local_date, availability.start_at AS availability_start_at, ' +
          'availability.end_at AS availability_end_at, availability.timezone AS availability_timezone, ' +
          "(SELECT media.id FROM profile_media media WHERE media.user_id = profiles.user_id AND media.type = 'photo' " +
          "AND media.moderation_status = 'approved' ORDER BY media.position LIMIT 1) AS primary_media_id " +
          'FROM profiles JOIN users ON users.id = profiles.user_id ' +
          'LEFT JOIN profile_connections connections ON connections.user_id = profiles.user_id ' +
          'LEFT JOIN presence_preferences presence_pref ON presence_pref.user_id = users.id ' +
          'LEFT JOIN user_interests shared ON shared.user_id = profiles.user_id AND shared.interest_id IN ' +
          '(SELECT interest_id FROM user_interests WHERE user_id = ?) ' +
          'LEFT JOIN profile_lift_activations lifts ON lifts.user_id = profiles.user_id AND lifts.ends_at > ? ' +
          'LEFT JOIN daily_updates updates ON updates.user_id = profiles.user_id AND updates.expires_at > ? AND updates.deleted_at IS NULL ' +
          "AND (updates.visibility = 'discover' OR " +
          "(updates.visibility = 'liked' AND EXISTS (SELECT 1 FROM interactions liked WHERE liked.actor_id = updates.user_id AND liked.target_id = ? AND liked.kind IN ('like', 'super_spike') AND liked.undone_at IS NULL)) OR " +
          "(updates.visibility = 'matches' AND EXISTS (SELECT 1 FROM matches update_match WHERE update_match.status = 'active' AND ((update_match.user_a_id = ? AND update_match.user_b_id = profiles.user_id) OR (update_match.user_b_id = ? AND update_match.user_a_id = profiles.user_id))))) " +
          'LEFT JOIN daily_availability availability ON availability.user_id = profiles.user_id AND availability.end_at > ? ' +
          "AND EXISTS (SELECT 1 FROM matches availability_match WHERE availability_match.status = 'active' AND ((availability_match.user_a_id = ? AND availability_match.user_b_id = profiles.user_id) OR (availability_match.user_b_id = ? AND availability_match.user_a_id = profiles.user_id))) " +
          "WHERE profiles.user_id != ? AND profiles.discoverable = 1 AND users.status = 'active' " +
          locationSql +
          'AND NOT EXISTS (SELECT 1 FROM safety_actions blocked WHERE blocked.kind = ? AND ' +
          '((blocked.reporter_id = ? AND blocked.subject_id = profiles.user_id) OR ' +
          '(blocked.reporter_id = profiles.user_id AND blocked.subject_id = ?))) ' +
          'AND (NOT EXISTS (SELECT 1 FROM interactions seen WHERE seen.actor_id = ? AND seen.target_id = profiles.user_id ' +
          "AND seen.kind IN ('like', 'super_spike', 'pass') AND seen.undone_at IS NULL) " +
          (includeMatches
            ? "OR EXISTS (SELECT 1 FROM matches room_match WHERE room_match.status = 'active' AND ((room_match.user_a_id = ? AND room_match.user_b_id = profiles.user_id) OR (room_match.user_b_id = ? AND room_match.user_a_id = profiles.user_id))) "
            : '') +
          ') ' +
          'GROUP BY profiles.user_id ' +
          'ORDER BY (lifts.ends_at IS NOT NULL) DESC, shared_interests DESC, users.last_active_at DESC, profiles.user_id ' +
          'LIMIT ?',
      )
      .bind(
        user.id,
        Date.now(),
        Date.now(),
        user.id,
        user.id,
        user.id,
        Date.now(),
        user.id,
        user.id,
        user.id,
        ...locationParams,
        'block',
        user.id,
        user.id,
        user.id,
        ...(includeMatches ? [user.id, user.id] : []),
        500,
      )
      .all<Candidate>();
    const interestsByUser = new Map<string, string[]>();
    const mediaByUser = new Map<
      string,
      Array<{ type: 'photo' | 'video'; url: string }>
    >();
    const promptsByUser = new Map<
      string,
      Array<{ prompt: string; answer: string }>
    >();
    if (result.results.length) {
      const interests = await db
        .prepare(
          `SELECT user_interests.user_id, interests.label FROM user_interests JOIN interests ON interests.id = user_interests.interest_id WHERE user_interests.user_id IN (${result.results.map(() => '?').join(',')}) ORDER BY interests.label`,
        )
        .bind(...result.results.map((candidate) => candidate.user_id))
        .all<{ user_id: string; label: string }>();
      for (const item of interests.results) {
        if (typeof item.label !== 'string') continue;
        const labels = interestsByUser.get(item.user_id) || [];
        if (labels.length < 20 && !labels.includes(item.label))
          labels.push(item.label);
        interestsByUser.set(item.user_id, labels);
      }
      const prompts = await db
        .prepare(
          `SELECT user_id, prompt, answer FROM profile_prompts WHERE user_id IN (${result.results.map(() => '?').join(',')}) ORDER BY position, id`,
        )
        .bind(...result.results.map((candidate) => candidate.user_id))
        .all<{ user_id: string; prompt: string; answer: string }>();
      for (const item of prompts.results) {
        const items = promptsByUser.get(item.user_id) || [];
        if (
          typeof item.answer === 'string' &&
          item.answer.trim() &&
          items.length < 3
        ) {
          items.push({ prompt: item.prompt, answer: item.answer });
          promptsByUser.set(item.user_id, items);
        }
      }
      const media = await db
        .prepare(
          `SELECT id, user_id, type FROM profile_media WHERE user_id IN (${result.results.map(() => '?').join(',')}) AND moderation_status = 'approved' AND type IN ('photo', 'video') ORDER BY position, id`,
        )
        .bind(...result.results.map((candidate) => candidate.user_id))
        .all<{ id: string; user_id: string; type: 'photo' | 'video' }>();
      for (const item of media.results) {
        const items = mediaByUser.get(item.user_id) ?? [];
        if (
          items.filter((existing) => existing.type === item.type).length <
          (item.type === 'photo' ? 6 : 1)
        ) {
          items.push({ type: item.type, url: `/api/media/${item.id}` });
          mediaByUser.set(item.user_id, items);
        }
      }
    }
    const now = new Date();
    const profiles = result.results.flatMap((candidate) => {
      if (
        (location.mode === 'device' || location.mode === 'city') &&
        !matchesDiscoveryLocation(
          location,
          {
            latitudeE6: candidate.latitude_e6,
            longitudeE6: candidate.longitude_e6,
            city: candidate.city,
            discoveryCity: candidate.discovery_city,
          },
          maxDistanceKm,
        )
      )
        return [];
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
          connection: connectionFromRow(
            candidate as unknown as Record<string, unknown>,
          ),
          interests: interestsByUser.get(candidate.user_id) || [],
          media: mediaByUser.get(candidate.user_id) ?? [],
          name: candidate.display_name,
          age,
          zodiac: zodiacFromBirthDate(candidate.birth_date),
          gender: candidate.gender,
          facts: {
            height: candidate.height_cm ? `${candidate.height_cm} cm` : '',
            occupation: candidate.occupation || '',
            kids: candidate.kids || '',
            wantsKids: candidate.wants_kids || '',
            smoking: candidate.smoking || '',
            drinking: candidate.drinking || '',
            education: candidate.education || '',
            pets: candidate.pets || '',
          },
          bio: candidate.bio,
          prompts: promptsByUser.get(candidate.user_id) || [],
          city: candidate.city,
          region: candidate.region,
          relationshipGoal: candidate.relationship_goal,
          verified,
          active:
            candidate.show_online !== 0 &&
            isRecentlyActive(candidate.last_active_at),
          lastActiveAt:
            candidate.show_online === 0 ? null : candidate.last_active_at,
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
    return json({ profiles: profiles.slice(0, limit), count: profiles.length });
  });
}
