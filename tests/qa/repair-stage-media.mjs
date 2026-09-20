import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Explicit staging-only repair: never reset accounts or replace existing photos.
const root = fileURLToPath(new URL('../../', import.meta.url));
const exec = promisify(execFile);
const assets = [
  'maya',
  'lena',
  'imani',
  'ava',
  'noah',
  'mateo',
  'jordan',
  'elias',
];
const wrangler = (args) =>
  exec(
    process.execPath,
    [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), ...args],
    { cwd: root, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
  );
for (let index = 0; index < assets.length; index += 2) {
  await Promise.all(
    assets.slice(index, index + 2).map(async (asset) => {
      await wrangler([
        'r2',
        'object',
        'put',
        `spikedate-media-stage/qa-fixtures/v1/${asset}.png`,
        '--file',
        path.join(root, 'public', `${asset}.png`),
        '--content-type',
        'image/png',
        '--remote',
      ]);
      console.log(`Stored existing synthetic sample: ${asset}.png`);
    }),
  );
}
const now = Date.now();
const sql = Array.from({ length: 50 }, (_, offset) => {
  const suffix = String(offset + 1).padStart(3, '0');
  const asset = assets[(offset < 8 ? offset : offset - 8) % 8];
  return `INSERT INTO profile_media (id, user_id, object_key, type, position, moderation_status, explicit, created_at, updated_at) SELECT 'test-primary-${suffix}', 'test-${suffix}', 'qa-fixtures/v1/${asset}.png', 'photo', 0, 'approved', 0, ${now}, ${now} WHERE EXISTS (SELECT 1 FROM users WHERE id = 'test-${suffix}') AND NOT EXISTS (SELECT 1 FROM profile_media WHERE user_id = 'test-${suffix}' AND type = 'photo') AND NOT EXISTS (SELECT 1 FROM profile_media WHERE user_id = 'test-${suffix}' AND position = 0);`;
}).join('\n');
const dir = path.join(root, 'outputs', 'qa-media-repair');
await mkdir(dir, { recursive: true });
const file = path.join(dir, `repair-${now}.sql`);
await writeFile(file, sql);
const result = await wrangler([
  'd1',
  'execute',
  'spikedate-stage',
  '--config',
  'wrangler.stage.jsonc',
  '--remote',
  '--file',
  file,
]);
console.log(result.stdout);
console.log(
  'Repair finished; existing uploads and profile details were preserved.',
);
