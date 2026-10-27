// Local, human-operated handover backup. No network or Git operations.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateRoot = resolve(root, 'outputs/private-handover');
const encryptedPath = resolve(root, 'handover/spikedate-credentials.json.gpg');
const decryptedPath = resolve(privateRoot, 'decrypted-vault.json');
const configPath = resolve(privateRoot, 'inputs.json');
const gpgHome = resolve(privateRoot, 'gnupg');
const maxFileBytes = 5 * 1024 * 1024;
const maxBundleBytes = 24 * 1024 * 1024;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function buildBundle(config, base = root) {
  if (!config || !Array.isArray(config.files) || config.files.length > 30)
    throw new Error('Invalid local input list (maximum 30 explicit files).');
  const names = new Set();
  const files = [];
  const missing = [];
  let total = 0;
  for (const item of config.files) {
    if (!item || typeof item.name !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(item.name) || names.has(item.name) || typeof item.path !== 'string')
      throw new Error('Each input needs a unique safe name and an explicit path.');
    names.add(item.name);
    const path = resolve(base, item.path);
    if (!existsSync(path)) { missing.push(item.name); continue; }
    // Never recurse over directories or search a user's credential stores.
    const bytes = readFileSync(realpathSync(path));
    total += bytes.length;
    if (bytes.length > maxFileBytes || total > maxBundleBytes) throw new Error('Credential bundle size limit exceeded.');
    files.push({ name: item.name, sha256: sha256(bytes), dataBase64: bytes.toString('base64') });
  }
  if (!files.length) throw new Error('No input files found.');
  return { format: 'spikedate-credential-backup-v1', createdAt: new Date().toISOString(), files, missing,
    ownerNotes: config.ownerNotes || '',
    warning: 'Secret values may be outdated. This file is not a guarantee of active credentials or complete provider access.' };
}

function findGpg() {
  if (process.env.SPIKEDATE_GPG_PATH) return process.env.SPIKEDATE_GPG_PATH;
  const gitGpg = 'C:/Program Files/Git/usr/bin/gpg.exe';
  return process.platform === 'win32' && existsSync(gitGpg) ? gitGpg : 'gpg';
}

function gpg(args, input) {
  mkdirSync(gpgHome, { recursive: true, mode: 0o700 });
  const binary = findGpg();
  const gitBundled = process.platform === 'win32' && binary.replaceAll('\\', '/').includes('/Git/usr/bin/');
  const pathArg = (arg) => {
    const slash = arg.replaceAll('\\', '/');
    return gitBundled ? slash.replace(/^([A-Za-z]):\//, (_, drive) => '/' + drive.toLowerCase() + '/') : slash;
  };
  const result = spawnSync(binary, ['--homedir', pathArg(gpgHome), ...args.map(pathArg)], {
    input, stdio: [input ? 'pipe' : 'inherit', 'pipe', 'pipe'],
    maxBuffer: 40 * 1024 * 1024,
  });
  // Never echo GPG output/error strings; decrypted data or filenames may be secret.
  if (result.error || result.status !== 0) throw new Error('GnuPG failed or was cancelled. No success is claimed; check the local password dialog and GPG installation.');
  return result.stdout;
}

function main() {
  const action = process.argv[2];
  if (action === 'inspect') {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const bundle = buildBundle(config);
    console.log(JSON.stringify({ includedNames: bundle.files.map((f) => f.name), missingNames: bundle.missing,
      note: 'Inventory only. Values and source paths are not printed.' }, null, 2));
    return;
  }
  if (action === 'encrypt') {
    if (existsSync(encryptedPath)) throw new Error('Encrypted vault already exists. Preserve the prior version before creating a new one.');
    const bundle = buildBundle(JSON.parse(readFileSync(configPath, 'utf8')));
    const payload = Buffer.from(JSON.stringify(bundle));
    mkdirSync(dirname(encryptedPath), { recursive: true });
    console.log('GnuPG will ask you locally for a strong passphrase. Never send it in chat.');
    try {
      gpg(['--no-symkey-cache', '--symmetric', '--cipher-algo', 'AES256', '--output', encryptedPath], payload);
      console.log('Encrypted file created. Verify by decrypting locally before committing it. Missing items remain listed inside the encrypted bundle.');
    } finally { payload.fill(0); }
    return;
  }
  if (action === 'decrypt') {
    if (existsSync(decryptedPath)) throw new Error('Private decrypted file already exists; move it securely before decrypting again.');
    console.log('GnuPG will ask for the passphrase locally. Decrypted data stays in ignored outputs/private-handover.');
    const bytes = gpg(['--no-symkey-cache', '--decrypt', encryptedPath]);
    try {
      const bundle = JSON.parse(bytes.toString('utf8'));
      if (bundle.format !== 'spikedate-credential-backup-v1' || !Array.isArray(bundle.files)) throw new Error('Unsupported bundle format.');
      for (const f of bundle.files) {
        if (sha256(Buffer.from(f.dataBase64, 'base64')) !== f.sha256) throw new Error('Bundle checksum mismatch.');
      }
      mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
      writeFileSync(decryptedPath, bytes, { flag: 'wx', mode: 0o600 });
      console.log('Decryption and file checksums verified. Private output: outputs/private-handover/decrypted-vault.json');
    } finally { bytes.fill(0); }
    return;
  }
  throw new Error('Usage: node scripts/credential-vault.mjs inspect|encrypt|decrypt');
}

const invoked = process.argv[1] && isAbsolute(resolve(process.argv[1])) && relative(root, resolve(process.argv[1])) === 'scripts/credential-vault.mjs'.replaceAll('/', process.platform === 'win32' ? '\\' : '/');
if (invoked) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
