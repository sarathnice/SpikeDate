import { hashPassword } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

const firstNames = [
  'Maya',
  'Lena',
  'Imani',
  'Ava',
  'Noah',
  'Mateo',
  'Jordan',
  'Elias',
  'Sofia',
  'Amara',
  'Chloe',
  'Nina',
  'Zoe',
  'Layla',
  'Camila',
  'Mei',
  'Fatima',
  'Grace',
  'Elena',
  'Tara',
  'Jade',
  'Rhea',
  'Mila',
  'Daniel',
  'Arjun',
  'Marcus',
  'Theo',
  'Liam',
  'Omar',
  'Kenji',
  'Andre',
  'Samuel',
  'Rafael',
  'Ethan',
  'Dev',
  'Isaac',
  'Gabriel',
  'Mason',
  'Alexis',
  'River',
  'Quinn',
  'Sage',
  'Rowan',
  'Avery',
  'Jamie',
  'Morgan',
  'Taylor',
  'Casey',
  'Skyler',
  'Reese',
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
          const goals = ['Long-term', 'Marriage', 'Dating', 'Short-term'];
          const goal = goals[index % goals.length];
          const birthYear = 1986 + (index % 18);
          return [
            db
              .prepare(
                'INSERT OR IGNORE INTO users ' +
                  '(id, email, phone_number, phone_verified_at, password_hash, status, birth_date, terms_version, terms_accepted_at, last_active_at, created_at, updated_at) ' +
                  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(
                userId,
                email,
                `+1555000${suffix}`,
                now,
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
                  '(user_id, display_name, gender, bio, relationship_goal, city, country, verification_status, discoverable, discoverable_requested, completed_at, created_at, updated_at) ' +
                  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    await db.batch(
      [2, 3, 4, 5, 6].flatMap((index) => {
        const suffix = String(index).padStart(3, '0');
        const matchId = `test-match-001-${suffix}`;
        const conversationId = `test-conversation-001-${suffix}`;
        const messageId = `test-message-${suffix}-001`;
        return [
          db
            .prepare(
              'INSERT OR IGNORE INTO matches ' +
                '(id, user_a_id, user_b_id, status, matched_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              matchId,
              'test-001',
              `test-${suffix}`,
              'active',
              now,
              now,
              now,
            ),
          db
            .prepare(
              'INSERT OR IGNORE INTO conversations ' +
                '(id, match_id, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            )
            .bind(conversationId, matchId, now - index * 30_000, now, now),
          db
            .prepare(
              'INSERT OR IGNORE INTO messages ' +
                '(id, conversation_id, sender_id, body, client_id, delivered_at, created_at, updated_at) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              messageId,
              conversationId,
              `test-${suffix}`,
              `Hi from ${firstNames[index - 1]} — this is a synthetic unread test message.`,
              `seed-client-${suffix}`,
              now,
              now - index * 30_000,
              now,
            ),
        ];
      }),
    );
    await db.batch(
      [2, 3, 4, 5].map((index) => {
        const suffix = String(index).padStart(3, '0');
        return db
          .prepare(
            'INSERT OR IGNORE INTO daily_updates ' +
              '(id, user_id, text, visibility, available_tonight, expires_at, created_at, updated_at) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            `test-update-${suffix}`,
            `test-${suffix}`,
            index % 2
              ? 'Trying a new dinner spot tonight.'
              : 'Coffee, a walk, and a good conversation?',
            'discover',
            index % 2,
            now + 86_400_000,
            now,
            now,
          );
      }),
    );
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
