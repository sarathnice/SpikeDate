import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { stageDemoProfiles } from '../lib/stage-demo-profiles.ts';

const root = 'outputs/qa/profile-import/stage-transfer';
const manifest = JSON.parse(readFileSync(`${root}/bulk.json`, 'utf8'));
assert.equal(manifest.length, 2500);
const source = await getPlatformProxy({ configPath: 'wrangler.profile-demo.local.jsonc', envFiles: [], remoteBindings: false, persist: { path: resolve('outputs/qa/profile-import/local-state/v3') } });
const remote = await getPlatformProxy({ configPath: `${root}.json`, envFiles: [], remoteBindings: true, persist: false });
const cities = new Map(stageDemoProfiles.map(profile => [`${profile.city},${profile.region}`, profile]));
try {
  const statements = ['-- Additive fictional staging fixtures only. No deletions or verification evidence.'];
  const selected = {};
  const sqlValue = value => value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  for (const table of ['users', 'interests', 'profiles', 'preferences', 'presence_preferences', 'entitlement_wallets', 'profile_connections', 'profile_prompts', 'profile_media', 'user_interests']) {
    const filter = table === 'interests' ? "id IN (SELECT interest_id FROM user_interests WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]')" : `${table === 'users' ? 'id' : 'user_id'} GLOB 'demo-v2-[0-9][0-9][0-9]'`;
    const rows = (await source.env.DB.prepare(`SELECT * FROM ${table} WHERE ${filter}`).all()).results;
    const columns = new Set((await remote.env.DB.prepare(`PRAGMA table_info(${table})`).all()).results.map(row => row.name));
    for (const original of rows) {
      const row = { ...original };
      assert.ok(Object.keys(row).every(key => /^[a-z_][a-z0-9_]*$/.test(key) && columns.has(key)), `Schema differs: ${table}`);
      if (table === 'users') { row.last_active_at = null; row.terms_version = 'stage-fictional-fixture'; }
      if (table === 'profiles') {
        row.verification_status = 'unverified';
        // Fictional city-center coordinates allow the existing device-distance
        // filter to work. These are not real people's GPS positions.
        const city = cities.get(`${row.city},${row.region}`);
        assert.ok(city, `No fictional city center for ${row.city}`);
        if (row.latitude_e6 === null && row.longitude_e6 === null) {
          row.latitude_e6 = city.latitudeE6;
          row.longitude_e6 = city.longitudeE6;
        }
      }
      if (table === 'presence_preferences') row.show_online = 0;
      if (table === 'profile_media') {
        assert.ok(row.object_key.startsWith('fictional-local-v2/'));
        assert.equal(row.original_object_key, null);
        assert.equal(row.card_object_key, null);
        assert.equal(row.avatar_object_key, null);
        row.object_key = 'fictional-stage-v2/' + row.object_key.slice('fictional-local-v2/'.length);
        assert.ok(manifest.some(item => item.key === row.object_key));
      }
      const keys = Object.keys(row);
      statements.push(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(key => sqlValue(row[key])).join(',')});`);
    }
    selected[table] = rows.length;
  }
  assert.equal(selected.users, 500);
  assert.equal(selected.profiles, 500);
  assert.equal(selected.profile_media, 2500);
  writeFileSync(`${root}/profiles.sql`, statements.join('\n'));
  writeFileSync(`${root}/sql-manifest.json`, JSON.stringify(selected, null, 2));
  console.log(JSON.stringify({ preparedRows: selected, statements: statements.length - 1 }));
} finally { await Promise.all([source.dispose(), remote.dispose()]); }
