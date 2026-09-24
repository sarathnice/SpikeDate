import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { syntheticProfiles } from '../lib/synthetic-profiles.ts';
import { hashPassword } from '../lib/server/crypto.ts';

// Generates INSERT-only SQL for the second synthetic cohort. Apply only after
// checking that test-051..test-100 are absent in the target test database.
const target = resolve('outputs/qa/location/additional-profiles.sql');
const now = Date.now();
const passwordHash = await hashPassword('SpikeDate2026!');
const sql = [];
const quote = (value) =>
  value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const insert = (table, columns, values) =>
  `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${values.map(quote).join(', ')});`;

for (const [offset, fixture] of syntheticProfiles.entries()) {
  if (offset < 50) continue;
  const index = offset + 1;
  const suffix = String(index).padStart(3, '0');
  const goal = ['Long-term', 'Marriage', 'Dating', 'Short-term'][index % 4];
  const interestLabels = [
    ...(offset % 2 ? ['Cooking', 'Live music', 'Road trips'] : ['Coffee', 'Indie music', 'Nature trips']),
    ...(offset % 5 === 0 ? ['Arts & culture'] : []),
    ...(offset % 6 === 0 ? ['New in town'] : []),
  ];

  sql.push(insert('users',
    ['id', 'email', 'phone_number', 'phone_verified_at', 'password_hash', 'status', 'birth_date', 'terms_version', 'terms_accepted_at', 'last_active_at', 'created_at', 'updated_at'],
    [fixture.id, fixture.email, `+1202555${String(index).padStart(4, '0')}`, now, passwordHash, 'active', `${1986 + (index % 18)}-06-15`, '2026-09-12', now, now - index * 60_000, now, now]));
  sql.push(insert('profiles',
    ['user_id', 'display_name', 'gender', 'pronouns', 'bio', 'relationship_goal', 'city', 'region', 'country', 'latitude_e6', 'longitude_e6', 'verification_status', 'discoverable', 'discoverable_requested', 'completed_at', 'occupation', 'education', 'height_cm', 'kids', 'wants_kids', 'drinking', 'smoking', 'pets', 'created_at', 'updated_at'],
    [fixture.id, fixture.name, fixture.gender, fixture.gender === 'woman' ? 'she/her' : 'he/him', `Synthetic test profile ${suffix} for end-to-end validation.`, goal, fixture.city, fixture.region, 'US', index % 2 ? 42_360_000 : 42_370_000, index % 2 ? -71_060_000 : -71_110_000, 'verified', 1, 1, now, offset % 2 ? 'Designer' : 'Engineer', offset % 3 ? 'Bachelor’s degree' : 'Master’s degree', 160 + (offset % 30), offset % 4 ? 'No kids' : 'Has kids', offset % 3 ? 'Open to children' : 'Wants kids', offset % 2 ? 'Socially' : 'Never', 'No', offset % 2 ? 'Has a dog' : 'No pets', now, now]));
  sql.push(insert('preferences',
    ['user_id', 'genders_json', 'min_age', 'max_age', 'max_distance_km', 'relationship_goals_json', 'dealbreakers_json', 'created_at', 'updated_at'],
    [fixture.id, '[]', 21, 55, 80, '[]', '[]', now, now]));
  sql.push(insert('entitlement_wallets',
    ['user_id', 'super_spikes', 'profile_lifts', 'weekly_lift_available', 'version', 'created_at', 'updated_at'],
    [fixture.id, 3, 2, 1, 0, now, now]));
  const connection = fixture.connection;
  sql.push(insert('profile_connections',
    ['user_id', 'relationship_style', 'dating_pace', 'communication_preference', 'values_json', 'rhythm_json', 'languages_json', 'created_at', 'updated_at'],
    [fixture.id, connection.relationshipStyle, connection.datingPace, connection.communicationPreference, JSON.stringify(connection.values), JSON.stringify(connection.rhythm), JSON.stringify(connection.languages), now, now]));
  for (const [position, answer] of [
    offset % 2 ? 'Coffee and an easy conversation.' : 'A walk somewhere new.',
    offset % 2 ? 'Remembering the little things I share.' : 'Making time for an unhurried conversation.',
  ].entries()) {
    sql.push(insert('profile_prompts',
      ['id', 'user_id', 'prompt', 'answer', 'position', 'created_at', 'updated_at'],
      [`test-prompt-${suffix}-${position}`, fixture.id, position === 0 ? 'Our first date starts with…' : 'A little thing that makes me feel cared for…', answer, position, now, now]));
  }
  for (const label of interestLabels) {
    const interestId = `fixture-interest-${label.toLowerCase().replaceAll(' ', '-')}`;
    sql.push(insert('interests', ['id', 'label', 'category'], [interestId, label, 'interest']));
    sql.push(insert('user_interests', ['user_id', 'interest_id'], [fixture.id, interestId]));
  }
  for (let position = 0; position < 3; position++) {
    sql.push(insert('profile_media',
      ['id', 'user_id', 'object_key', 'type', 'position', 'moderation_status', 'explicit', 'created_at', 'updated_at'],
      [`test-${position === 0 ? 'primary' : 'gallery'}-${suffix}${position === 0 ? '' : `-${position}`}`, fixture.id, `qa-fixtures/v1/${fixture.asset}.png`, 'photo', position, 'approved', 0, now, now]));
  }
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, sql.join('\n') + '\n');
console.log(`Prepared ${syntheticProfiles.length - 50} insert-only profiles (${sql.length} statements) at ${target}`);
