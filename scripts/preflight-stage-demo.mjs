import { createHash } from 'node:crypto';
import { createReadStream, existsSync, openSync, closeSync, readSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { stageDemoProfiles } from '../lib/stage-demo-profiles.ts';

// This is deliberately read-only. Never reset the stage database until every
// profile has six distinct, high-resolution image assets ready for upload.
const root = resolve('assets/stage-demo');
const missing = [];
const invalid = [];
const duplicateHashes = new Map();
let checked = 0;

function pngDimensions(path) {
  const handle = openSync(path, 'r');
  try {
    const header = Buffer.alloc(24);
    readSync(handle, header, 0, header.length, 0);
    if (header.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    closeSync(handle);
  }
}

async function hash(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

for (const profile of stageDemoProfiles) {
  for (const relativePath of profile.photoPaths) {
    const path = resolve(relativePath);
    if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) {
      invalid.push(`${relativePath}: outside stage-demo assets`);
      continue;
    }
    if (!existsSync(path)) {
      missing.push(relativePath);
      continue;
    }
    const dimensions = pngDimensions(path);
    if (!dimensions || dimensions.width < 900 || dimensions.height < 1125 || statSync(path).size < 100_000) {
      invalid.push(`${relativePath}: expected a PNG at least 900×1125 and 100 KB`);
      continue;
    }
    const digest = await hash(path);
    if (duplicateHashes.has(digest))
      invalid.push(`${relativePath}: duplicates ${duplicateHashes.get(digest)}`);
    else
      duplicateHashes.set(digest, relativePath);
    checked += 1;
  }
}

console.log(`Validated ${checked}/${stageDemoProfiles.length * 6} photos for ${stageDemoProfiles.length} demo profiles.`);
if (missing.length || invalid.length) {
  if (missing.length) console.error(`Missing ${missing.length} photos. First: ${missing.slice(0, 8).join(', ')}`);
  if (invalid.length) console.error(`Invalid ${invalid.length} photos. First: ${invalid.slice(0, 8).join(', ')}`);
  process.exitCode = 1;
}
