import { hashPassword } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

const firstNames = [
  'Alex',
  'Maya',
  'Jordan',
  'Priya',
  'Leo',
  'Lena',
  'Avery',
  'Noah',
  'Mia',
  'Ethan',
  'Sofia',
  'Kai',
  'Amara',
  'Mateo',
  'Zoe',
  'Ravi',
  'Chloe',
  'Owen',
  'Nina',
  'Jules',
  'Aria',
  'Miles',
  'Ivy',
  'Theo',
  'Layla',
  'Ezra',
  'Sage',
  'Luca',
  'Nora',
  'Finn',
  'Isla',
  'Sam',
  'Elena',
  'Nico',
  'Aisha',
  'Ben',
  'Mei',
  'Drew',
  'Ana',
  'Dev',
  'Ruby',
  'Cole',
  'Jade',
  'Omar',
  'Elle',
  'Max',
  'Tara',
  'Ian',
  'Rina',
  'Hugo',
];

function authorized(request: Request) {
  const expected = process.env.SPIKEDATE_TEST_SEED_SECRET;
  return (
    process.env.SPIKEDATE_TEST_SEED_ENABLED === 'true' &&
    !!expected &&
    request.headers.get('x-spikedate-seed-secret') === expected
  );
}

export async function POST(request: Request) {
  if (!authorized(request))
    return json({ error: 'Not found.' }, { status: 404 });
  return withDatabase(async () => {
    const db = getDb();
    const now = Date.now();
    const passwordHash = await hashPassword('SpikeDate2026!');
    for (let offset = 0; offset < firstNames.length; offset += 10) {
      const group = firstNames.slice(offset, offset + 10);
      await db.batch(
        group.flatMap((name, groupIndex) => {
          const index = offset + groupIndex + 1;
          const suffix = String(index).padStart(3, '0');
          const userId = 'test-' + suffix;
          const email = 'test' + suffix + '@spikedate.test';
          const gender =
            index % 3 === 0 ? 'nonbinary' : index % 2 ? 'woman' : 'man';
          const goals = [
            'Long-term relationship',
            'Marriage',
            'Dating',
            'Open to short-term',
          ];
          const goal = goals[index % goals.length];
          const birthYear = 1986 + (index % 18);
          return [
            db
              .prepare(
                'INSERT OR IGNORE INTO users ' +
                  '(id, email, password_hash, status, birth_date, terms_version, terms_accepted_at, last_active_at, created_at, updated_at) ' +
                  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(
                userId,
                email,
                passwordHash,
                'active',
                String(birthYear) + '-06-15',
                '2026-09-12',
                now,
                now - index * 60_000,
                now,
                now,
              ),
            db
              .prepare(
                'INSERT OR IGNORE INTO profiles ' +
                  '(user_id, display_name, gender, bio, relationship_goal, city, country, verification_status, discoverable, completed_at, created_at, updated_at) ' +
                  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(
                userId,
                name,
                gender,
                'Synthetic test profile ' +
                  suffix +
                  ' for end-to-end validation.',
                goal,
                index % 2 ? 'Boston' : 'Cambridge',
                'US',
                index % 5 ? 'verified' : 'unverified',
                1,
                now,
                now,
                now,
              ),
            db
              .prepare(
                'INSERT OR IGNORE INTO preferences ' +
                  '(user_id, genders_json, min_age, max_age, max_distance_km, relationship_goals_json, dealbreakers_json, created_at, updated_at) ' +
                  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(userId, '[]', 21, 55, 80, '[]', '[]', now, now),
            db
              .prepare(
                'INSERT OR IGNORE INTO entitlement_wallets ' +
                  '(user_id, super_spikes, profile_lifts, weekly_lift_available, version, created_at, updated_at) ' +
                  'VALUES (?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(userId, 3, 2, 1, 0, now, now),
          ];
        }),
      );
    }
    const adminId = 'test-001';
    await db
      .prepare(
        'INSERT OR IGNORE INTO admin_users (user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .bind(adminId, 'super_admin', now, now)
      .run();
    return json({
      created: firstNames.length,
      password: 'SpikeDate2026!',
      firstAccount: 'test001@spikedate.test',
    });
  });
}

export async function DELETE(request: Request) {
  if (!authorized(request))
    return json({ error: 'Not found.' }, { status: 404 });
  return withDatabase(async () => {
    const db = getDb();
    await db.prepare("DELETE FROM users WHERE id LIKE 'test-%'").run();
    return json({ deleted: true });
  });
}
