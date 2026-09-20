import { env } from 'cloudflare:workers';
import { hashPassword } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';
import { syntheticProfiles } from '@/lib/synthetic-profiles';

export const runtime = 'edge';

const firstNames = syntheticProfiles.map((profile) => profile.name);

function authorized(request: Request) {
  const runtimeEnv = env as unknown as {
    SPIKEDATE_TEST_SEED_ENABLED?: string;
    SPIKEDATE_TEST_SEED_SECRET?: string;
  };
  const expected = runtimeEnv.SPIKEDATE_TEST_SEED_SECRET;
  return (
    runtimeEnv.SPIKEDATE_TEST_SEED_ENABLED === 'true' &&
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
          const gender = syntheticProfiles[index - 1].gender;
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
                `+1202555${String(index).padStart(4, '0')}`,
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
                'verified',
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
    const availableDay = new Date(now + 86_400_000);
    const availableLocalDate = availableDay.toISOString().slice(0, 10);
    await db.batch(
      [2, 3, 4, 5].map((index) => {
        const startAt = new Date(`${availableLocalDate}T18:00:00-04:00`);
        startAt.setMinutes((index - 2) * 30);
        const endAt = new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
        const suffix = String(index).padStart(3, '0');
        return db
          .prepare(
            'INSERT INTO daily_availability ' +
              '(user_id, local_date, start_at, end_at, timezone, visibility, created_at, updated_at) ' +
              "VALUES (?, ?, ?, ?, ?, 'matches', ?, ?) ON CONFLICT(user_id) DO UPDATE SET " +
              'local_date = excluded.local_date, start_at = excluded.start_at, end_at = excluded.end_at, ' +
              'timezone = excluded.timezone, updated_at = excluded.updated_at',
          )
          .bind(
            `test-${suffix}`,
            availableLocalDate,
            startAt.getTime(),
            endAt.getTime(),
            'America/New_York',
            now,
            now,
          );
      }),
    );
    // Reuse only the synthetic fixture assets already provisioned in this bucket.
    // Never create a media row for a missing object, or replace a tester's upload.
    const bucket = (
      env as unknown as { MEDIA?: { head: (key: string) => Promise<unknown> } }
    ).MEDIA;
    const fixtureAssets = [
      'maya',
      'lena',
      'imani',
      'ava',
      'noah',
      'mateo',
      'jordan',
      'elias',
    ];
    const availableAssets = new Set<string>();
    if (bucket) {
      await Promise.all(
        fixtureAssets.map(async (asset) => {
          if (await bucket.head(`qa-fixtures/v1/${asset}.png`))
            availableAssets.add(asset);
        }),
      );
      const statements = firstNames.flatMap((_, index) => {
        const suffix = String(index + 1).padStart(3, '0');
        const asset = syntheticProfiles[index].asset;
        if (!availableAssets.has(asset)) return [];
        return [
          db
            .prepare(
              'INSERT OR IGNORE INTO profile_media (id, user_id, object_key, type, position, moderation_status, explicit, created_at, updated_at) ' +
                "SELECT ?, ?, ?, 'photo', 0, 'approved', 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM profile_media WHERE user_id = ? AND type = 'photo')",
            )
            .bind(
              `test-primary-${suffix}`,
              `test-${suffix}`,
              `qa-fixtures/v1/${asset}.png`,
              now,
              now,
              `test-${suffix}`,
            ),
        ];
      });
      if (statements.length) await db.batch(statements);
    }
    const adminId = 'test-001';
    for (const [offset, fixture] of syntheticProfiles.entries()) {
      const connection = fixture.connection;
      const suffix = String(offset + 1).padStart(3, '0');
      const interestLabels = [
        ...(offset % 2
          ? ['Cooking', 'Live music', 'Road trips']
          : ['Coffee', 'Indie music', 'Nature trips']),
        ...(offset % 5 === 0 ? ['Arts & culture'] : []),
        ...(offset % 6 === 0 ? ['New in town'] : []),
      ];
      await db.batch([
        db
          .prepare(
            'UPDATE profiles SET pronouns = ?, occupation = ?, education = ?, height_cm = ?, kids = ?, wants_kids = ?, drinking = ?, smoking = ?, pets = ? WHERE user_id = ?',
          )
          .bind(
            fixture.gender === 'woman' ? 'she/her' : 'he/him',
            offset % 2 ? 'Designer' : 'Engineer',
            offset % 3 ? 'Bachelor’s degree' : 'Master’s degree',
            160 + (offset % 30),
            offset % 4 ? 'No kids' : 'Has kids',
            offset % 3 ? 'Open to children' : 'Wants kids',
            offset % 2 ? 'Socially' : 'Never',
            'No',
            offset % 2 ? 'Has a dog' : 'No pets',
            fixture.id,
          ),
        db
          .prepare(
            'INSERT OR IGNORE INTO profile_connections (user_id, relationship_style, dating_pace, communication_preference, values_json, rhythm_json, languages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            fixture.id,
            connection.relationshipStyle,
            connection.datingPace,
            connection.communicationPreference,
            JSON.stringify(connection.values),
            JSON.stringify(connection.rhythm),
            JSON.stringify(connection.languages),
            now,
            now,
          ),
        ...[
          {
            prompt: 'Our first date starts with…',
            answer:
              offset % 2
                ? 'Coffee and an easy conversation.'
                : 'A walk somewhere new.',
          },
          {
            prompt: 'A little thing that makes me feel cared for…',
            answer:
              offset % 2
                ? 'Remembering the little things I share.'
                : 'Making time for an unhurried conversation.',
          },
        ].map((prompt, position) =>
          db
            .prepare(
              'INSERT OR IGNORE INTO profile_prompts (id, user_id, prompt, answer, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              `test-prompt-${suffix}-${position}`,
              fixture.id,
              prompt.prompt,
              prompt.answer,
              position,
              now,
              now,
            ),
        ),
        ...interestLabels.flatMap((label) => [
          db
            .prepare(
              "INSERT OR IGNORE INTO interests (id, label, category) VALUES (?, ?, 'interest')",
            )
            .bind(
              `fixture-interest-${label.toLowerCase().replaceAll(' ', '-')}`,
              label,
            ),
          db
            .prepare(
              'INSERT OR IGNORE INTO user_interests (user_id, interest_id) VALUES (?, (SELECT id FROM interests WHERE label = ? LIMIT 1))',
            )
            .bind(fixture.id, label),
        ]),
        ...(availableAssets.has(fixture.asset)
          ? [1, 2].map((position) =>
              db
                .prepare(
                  "INSERT OR IGNORE INTO profile_media (id, user_id, object_key, type, position, moderation_status, explicit, created_at, updated_at) VALUES (?, ?, ?, 'photo', ?, 'approved', 0, ?, ?)",
                )
                .bind(
                  `test-gallery-${suffix}-${position}`,
                  fixture.id,
                  `qa-fixtures/v1/${fixture.asset}.png`,
                  position,
                  now,
                  now,
                ),
            )
          : []),
      ]);
    }
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
      fixturePhotoAssetsAvailable: availableAssets.size,
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
