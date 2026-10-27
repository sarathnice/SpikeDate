import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getPlatformProxy } from 'wrangler';

const root = resolve('outputs/qa/profile-import/stage-transfer');
mkdirSync(join(root, 'photos'), { recursive: true });
const local = await getPlatformProxy({ configPath: 'wrangler.profile-demo.local.jsonc', envFiles: [], remoteBindings: false, persist: { path: resolve('outputs/qa/profile-import/local-state/v3') } });
try {
  const rows = (await local.env.DB.prepare("SELECT id,object_key FROM profile_media WHERE user_id GLOB 'demo-v2-[0-9][0-9][0-9]' ORDER BY id").all()).results;
  assert.equal(rows.length, 2500);
  const manifest = [], verification = [];
  let cursor = 0, count = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      assert.match(row.id, /^demo-v2-media-\d{3}-[0-4]$/);
      assert.ok(row.object_key.startsWith('fictional-local-v2/'));
      const object = await local.env.MEDIA.get(row.object_key);
      assert.ok(object && object.customMetadata?.fictional === 'true');
      const data = new Uint8Array(await object.arrayBuffer());
      const file = join(root, 'photos', `${row.id}.webp`);
      if (!existsSync(file)) writeFileSync(file, data);
      else assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), createHash('sha256').update(data).digest('hex'));
      const key = 'fictional-stage-v2/' + row.object_key.slice('fictional-local-v2/'.length);
      manifest.push({ key, file });
      verification.push({ key, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
      if (++count % 500 === 0) console.log(`Prepared bulk photos ${count}/2500`);
    }
  }));
  manifest.sort((a,b) => a.key.localeCompare(b.key));
  writeFileSync(join(root, 'bulk.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'photo-verification.json'), JSON.stringify(verification));
  console.log(`Prepared ${manifest.length} Cloudflare bulk-upload entries.`);
} finally { await local.dispose(); }
