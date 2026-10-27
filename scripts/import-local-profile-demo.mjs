import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { getPlatformProxy } from 'wrangler';
import { hashPassword } from '../lib/server/crypto.ts';

const sourceRoot = resolve(process.argv.slice(2).find(argument => !argument.startsWith('--')) || 'C:/Users/sarat/OneDrive/profiles-v2');
const stateRoot = resolve('outputs/qa/profile-import/local-state');
const outputRoot = resolve('outputs/qa/profile-import');
function fixtureBirthDate(age, index, now = new Date()) {
  const month = (index * 7) % 12 + 1;
  const day = (index * 11) % 28 + 1;
  const birthdayPending = month > now.getUTCMonth() + 1 || (month === now.getUTCMonth() + 1 && day > now.getUTCDate());
  return `${now.getUTCFullYear() - age - Number(birthdayPending)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const configPath = resolve('wrangler.profile-demo.local.jsonc');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
assert.equal(config.name, 'spikedate-profile-demo-local');
assert.equal(config.d1_databases[0].database_id, '22222222-2222-4222-8222-222222222222');
assert.equal(config.vars.SPIKEDATE_LOCAL_PROFILE_DEMO, 'true');
const manifest = JSON.parse(readFileSync(join(sourceRoot, 'profiles.json'), 'utf8'));
assert.equal(manifest.kind, 'local-demo-preview');
assert.equal(manifest.profiles.length, 500);
const digests = new Set();
const media = [];
for (const profile of manifest.profiles) {
  assert.equal(profile.demo, true);
  assert.match(profile.id, /^local-\d{3}$/);
  assert.ok(profile.age >= 18 && profile.age <= 100);
  assert.equal(profile.photos.length, 5);
  assert.ok(Number.isInteger(profile.coverPhotoIndex) && profile.coverPhotoIndex >= 0 && profile.coverPhotoIndex < 5);
  const ordered = [profile.photos[profile.coverPhotoIndex], ...profile.photos.filter((_, index) => index !== profile.coverPhotoIndex)];
  for (const [position, photo] of ordered.entries()) {
    const absolute = resolve(sourceRoot, photo.path);
    assert.ok(absolute.startsWith(sourceRoot + '\\'), 'Source outside profile folder');
    const bytes = readFileSync(absolute);
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.ok(!digests.has(digest), `Duplicate photo: ${photo.path}`);
    digests.add(digest);
    const metadata = await sharp(bytes, { failOn: 'warning' }).metadata();
    assert.equal(metadata.format, 'png');
    assert.ok(metadata.width >= 512 && metadata.height >= 512);
    media.push({ source: absolute, digest, profile, position, width: metadata.width, height: metadata.height,
      key: `fictional-local-v2/${profile.id}/${position}.webp`,
      id: `demo-v2-media-${profile.id.slice(6)}-${position}` });
  }
}
console.log(`Preflight passed: ${manifest.profiles.length} profiles and ${media.length} distinct photo files.`);
if (!process.argv.includes('--apply')) {
  console.log('Read-only preflight complete. Use --apply to import into the dedicated local database and bucket.');
  process.exit(0);
}
mkdirSync(outputRoot, { recursive: true });
const credentialsPath = join(outputRoot, 'login.json');
const credentials = existsSync(credentialsPath)
  ? JSON.parse(readFileSync(credentialsPath, 'utf8'))
  : { password: `LocalDemo-${randomBytes(12).toString('base64url')}!`, email: 'demo101@spikedate.test', note: 'Local fictional fixtures only. Same test password works for demo101 through demo600.' };
writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
writeFileSync(join(outputRoot, 'local.env'), `# Local demo: no cloud credentials.\nSPIKEDATE_LOCAL_PROFILE_DEMO=true\nSPIKEDATE_LOCAL_DEMO_PASSWORD=${JSON.stringify(credentials.password)}\n`);
const passwordHash = await hashPassword(credentials.password);
const proxy = await getPlatformProxy({ configPath, envFiles: [], remoteBindings: false, persist: { path: join(stateRoot, 'v3') } });
try {
  const { DB: db, MEDIA: bucket } = proxy.env;
  const unrelated = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE id NOT LIKE 'demo-v2-%'").first();
  assert.equal(unrelated.count, 0, 'Expected the isolated demo database; found unrelated users');
  let cursor = 0;
  let uploaded = 0;
  let skipped = 0;
  const now = Date.now();
  const year = new Date(now).getUTCFullYear();
  if (!process.argv.includes('--finalize')) {
  async function upload() {
    while (cursor < media.length) {
      const item = media[cursor++];
      const existing = await bucket.head(item.key);
      if (existing) {
        assert.equal(existing.customMetadata?.sourceSha256, item.digest, `Conflicting existing object ${item.key}`);
        skipped += 1;
      } else {
        const encoded = await sharp(item.source, { failOn: 'warning' }).webp({ quality: 92, effort: 4 }).toBuffer();
        await bucket.put(item.key, encoded, { httpMetadata: { contentType: 'image/webp' }, customMetadata: { sourceSha256: item.digest, fictional: 'true', batch: 'local-v2' } });
        uploaded += 1;
      }
      if ((uploaded + skipped) % 250 === 0) console.log(`Local photo storage: ${uploaded + skipped}/${media.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, upload));
  for (const [index, profile] of manifest.profiles.entries()) {
    const suffix = profile.id.slice(6);
    const userId = `demo-v2-${suffix}`;
    const statements = [
      db.prepare('INSERT OR IGNORE INTO users (id,email,password_hash,status,birth_date,terms_version,terms_accepted_at,last_active_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,NULL,?,?)')
        .bind(userId, `demo${suffix}@spikedate.test`, passwordHash, 'active', fixtureBirthDate(profile.age, index), 'local-fictional-fixture', now, now, now),
      db.prepare('INSERT OR IGNORE INTO profiles (user_id,display_name,gender,pronouns,bio,relationship_goal,city,region,country,verification_status,discoverable,discoverable_requested,completed_at,discovery_location_mode,discovery_city,discovery_location_updated_at,occupation,education,height_cm,kids,wants_kids,drinking,smoking,pets,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(userId, profile.displayName, profile.gender, profile.gender === 'woman' ? 'she/her' : 'he/him', profile.bio, profile.relationshipGoal === 'Getting to know someone' ? 'Dating' : profile.relationshipGoal, profile.city, profile.region, 'US', 'unverified', 1, 1, now, 'city', profile.city, now,
          ['Designer', 'Teacher', 'Engineer', 'Project manager', 'Chef', 'Researcher', 'Writer', 'Nurse', 'Architect', 'Analyst'][index % 10],
          ['Bachelor’s degree', 'Master’s degree', 'Trade school', 'Some college'][index % 4], (profile.gender === 'woman' ? 155 : 166) + (index * 3) % 25,
          index % 5 ? 'No kids' : 'Has kids', ['Open to children', 'Wants kids', 'Does not want kids'][index % 3], index % 3 ? 'Socially' : 'Never', 'No', index % 2 ? 'Has a dog' : 'No pets', now, now),
      db.prepare('INSERT OR IGNORE INTO preferences (user_id,genders_json,min_age,max_age,max_distance_km,relationship_goals_json,dealbreakers_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(userId, '[]', 18, 70, 100, '[]', '[]', now, now),
      db.prepare('INSERT OR IGNORE INTO presence_preferences (user_id,show_online) VALUES (?,0)').bind(userId),
      db.prepare('INSERT OR IGNORE INTO entitlement_wallets (user_id,super_spikes,profile_lifts,weekly_lift_available,version,created_at,updated_at) VALUES (?,3,2,1,0,?,?)').bind(userId, now, now),
      db.prepare('INSERT OR IGNORE INTO profile_connections (user_id,relationship_style,dating_pace,communication_preference,values_json,rhythm_json,languages_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(userId, 'Monogamy', ['Chat first', 'Meet when comfortable'][index % 2], ['Texting', 'Calls'][index % 2], JSON.stringify(['Kindness', 'Curiosity']), JSON.stringify([['Quiet weekends', 'Social weekends', 'A mix of both'][index % 3]]), '["English"]', now, now),
      db.prepare('INSERT OR IGNORE INTO profile_prompts (id,user_id,prompt,answer,position,created_at,updated_at) VALUES (?,?,?,?,0,?,?)').bind(`demo-v2-prompt-${suffix}`, userId, 'A good weekend includes…', profile.interests.join(', ') + '.', now, now),
    ];
    for (const item of media.filter(item => item.profile.id === profile.id)) {
      statements.push(db.prepare("INSERT OR IGNORE INTO profile_media (id,user_id,object_key,type,position,width,height,source_width,source_height,moderation_status,explicit,created_at,updated_at) VALUES (?,?,?,'photo',?,?,?,?,?,'approved',0,?,?)")
        .bind(item.id, userId, item.key, item.position, item.width, item.height, item.width, item.height, now, now));
    }
    for (const label of profile.interests) {
      const interestId = `demo-v2-interest-${createHash('sha256').update(label).digest('hex').slice(0, 16)}`;
      statements.push(db.prepare("INSERT OR IGNORE INTO interests (id,label,category) VALUES (?,?,'interest')").bind(interestId, label));
      statements.push(db.prepare('INSERT OR IGNORE INTO user_interests (user_id,interest_id) VALUES (?,?)').bind(userId, interestId));
    }
    await db.batch(statements);
    if ((index + 1) % 100 === 0) console.log(`Local app profiles: ${index + 1}/500`);
  }
  }
  // Correct the initial fixture-only defaults without touching edited dates.
  for (let offset = 0; offset < manifest.profiles.length; offset += 50) {
    await db.batch(manifest.profiles.slice(offset, offset + 50).map((profile, index) =>
      db.prepare('UPDATE users SET birth_date = ? WHERE id = ? AND birth_date = ?')
        .bind(fixtureBirthDate(profile.age, offset + index), `demo-v2-${profile.id.slice(6)}`, `${year - profile.age}-01-01`)));
  }
  await db.prepare("UPDATE profile_connections SET relationship_style = 'Monogamy', dating_pace = CASE WHEN dating_pace = 'Slow and intentional' THEN 'Chat first' ELSE 'Meet when comfortable' END, communication_preference = CASE WHEN communication_preference = 'Messages first' THEN 'Texting' ELSE 'Calls' END, rhythm_json = '[\"A mix of both\"]' WHERE user_id LIKE 'demo-v2-%' AND relationship_style = 'Monogamous'").run();
  const counts = await db.prepare('SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM profiles) AS profiles,(SELECT COUNT(*) FROM profile_media) AS photos,(SELECT COUNT(*) FROM profiles WHERE verification_status != \'unverified\') AS verified').first();
  assert.equal(counts.users, 500);
  assert.equal(counts.profiles, 500);
  assert.equal(counts.photos, 2500);
  assert.equal(counts.verified, 0);
  const invalidCounts = await db.prepare('SELECT user_id FROM profile_media GROUP BY user_id HAVING COUNT(*) != 5').all();
  assert.equal(invalidCounts.results.length, 0);
  writeFileSync(join(outputRoot, 'import-result.json'), JSON.stringify({ mode: 'local-fictional-demo', sourceRoot, stateRoot, counts, uploaded, skipped, credentialsPath, importedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ ...counts, uploaded, skipped, credentialsPath }));
} finally { await proxy.dispose(); }
