import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';

const root = 'outputs/qa/profile-import/stage-transfer';
const beforeName = readdirSync(root).filter(name => /^before-\d+\.json$/.test(name)).sort()[0];
assert.ok(beforeName);
const before = JSON.parse(readFileSync(join(root, beforeName), 'utf8'));
const photos = JSON.parse(readFileSync(join(root, 'photo-verification.json'), 'utf8'));
const remote = await getPlatformProxy({ configPath: `${root}.json`, envFiles: [], remoteBindings: true, persist: false });
try {
  const db = remote.env.DB;
  const counts = await db.prepare("SELECT (SELECT COUNT(*) FROM users WHERE id GLOB 'demo-v2-[0-9][0-9][0-9]') AS users,(SELECT COUNT(*) FROM profiles WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]') AS profiles,(SELECT COUNT(*) FROM profile_media WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]') AS photos,(SELECT COUNT(*) FROM profiles WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]' AND verification_status != 'unverified') AS verified").first();
  assert.deepEqual(counts, { users: 500, profiles: 500, photos: 2500, verified: 0 });
  const users = (await db.prepare('SELECT id,email FROM users ORDER BY id').all()).results;
  const profiles = (await db.prepare('SELECT user_id,verification_status FROM profiles ORDER BY user_id').all()).results;
  assert.ok(before.users.every(old => users.some(row => row.id === old.id && row.email === old.email)), 'Missing original account');
  assert.ok(before.profiles.every(old => profiles.some(row => row.user_id === old.user_id && row.verification_status === old.verification_status)), 'Original verification changed');
  assert.equal(users.length, before.users.length + 500);
  const invalid = (await db.prepare("SELECT user_id FROM profile_media WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]' GROUP BY user_id HAVING COUNT(*) != 5").all()).results;
  assert.equal(invalid.length, 0);
  const distribution = (await db.prepare("SELECT gender,COUNT(*) AS count,COUNT(DISTINCT city) AS cities FROM profiles WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]' GROUP BY gender").all()).results;
  const located = await db.prepare("SELECT COUNT(*) AS count FROM profiles WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]' AND latitude_e6 IS NOT NULL AND longitude_e6 IS NOT NULL").first();
  assert.equal(located.count, 500);
  console.log('Verified D1 counts, original accounts, verification states, and city coordinates.');
  const stored = [];
  const bulk = JSON.parse(readFileSync(join(root, 'bulk.json'), 'utf8'));
  let cursor;
  do {
    const page = await remote.env.MEDIA.list({ prefix: 'fictional-stage-v2/', limit: 1000, ...(cursor ? { cursor } : {}) });
    stored.push(...page.objects);
    console.log(`Listed cloud photos: ${stored.length}/2500`);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  assert.equal(stored.length, 2500);
  const byKey = new Map(stored.map(object => [object.key, object]));
  const filesByKey = new Map(bulk.map(item => [item.key, item.file]));
  let etagChecks = 0;
  for (const photo of photos) {
    const object = byKey.get(photo.key);
    assert.ok(object && object.size === photo.bytes, `Missing or different-sized object ${photo.key}`);
    const file = filesByKey.get(photo.key);
    assert.equal(object.etag, createHash('md5').update(readFileSync(file)).digest('hex'), `Object ETag mismatch ${photo.key}`);
    etagChecks++;
    if (etagChecks % 500 === 0) console.log(`Verified photo sizes/ETags: ${etagChecks}/2500`);
  }
  let hashChecks = 0;
  for (const index of [0, 1, 249, 499, 749, 999, 1249, 1499, 1749, 1999, 2249, 2499]) {
    const expected = photos[index];
    const object = await remote.env.MEDIA.get(expected.key);
    assert.ok(object);
    const digest = createHash('sha256').update(new Uint8Array(await object.arrayBuffer())).digest('hex');
    assert.equal(digest, expected.sha256, `Photo hash mismatch: ${expected.key}`);
    hashChecks++;
  }
  const response = await fetch('https://spikedate-stage.sarathnice.workers.dev/');
  const html = await response.text();
  assert.equal((html.match(/data-stage-fictional=/g) || []).length, 1);
  assert.ok(html.includes('Test environment · fictional profiles'));
  assert.ok(!html.includes('Local demo'));
  const result = { counts, distribution, fictionalCityCoordinates: located.count, stageUsersBefore: before.users.length, stageUsersAfter: users.length, objects: stored.length, bytes: stored.reduce((sum, row) => sum + row.size, 0), etagChecks, hashChecks, originalAccountsPreserved: true, stageNotice: true, checkedAt: new Date().toISOString() };
  writeFileSync(join(root, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await remote.dispose(); }
