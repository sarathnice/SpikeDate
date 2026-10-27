import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildBundle } from '../scripts/credential-vault.mjs';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'spikedate-vault-test-'));
  return { dir, cleanup: () => {
    const rel = relative(resolve(tmpdir()), resolve(dir));
    if (!rel.startsWith('spikedate-vault-test-') || rel.includes('..')) throw new Error('Unsafe test cleanup target');
    rmSync(dir, { recursive: true, force: true });
  } };
}

it('packages only explicit files and marks missing credentials without inventing values', () => {
  const {dir, cleanup} = fixture();
  try {
    writeFileSync(join(dir, 'fake-key'), 'unit-test-only-not-a-real-credential');
    const bundle = buildBundle({ files: [{name:'test-key',path:'fake-key'}, {name:'missing-token',path:'absent'}] }, dir);
    expect(bundle.files.map((f: {name: string}) => f.name)).toEqual(['test-key']);
    expect(bundle.missing).toEqual(['missing-token']);
    expect(JSON.stringify(bundle)).not.toContain(dir);
    expect(Buffer.from(bundle.files[0].dataBase64, 'base64').toString()).toBe('unit-test-only-not-a-real-credential');
  } finally { cleanup(); }
});

it('rejects duplicate names, invalid lists and empty bundles', () => {
  expect(() => buildBundle({files:[]}, '.')).toThrow('No input files');
  expect(() => buildBundle({files:[{name:'../unsafe',path:'none'}]}, '.')).toThrow('safe name');
  expect(() => buildBundle({files:[{name:'same',path:'none'}, {name:'same',path:'none'}]}, '.')).toThrow('safe name');
});

const gpg = process.platform === 'win32' && existsSync('C:/Program Files/Git/usr/bin/gpg.exe')
  ? 'C:/Program Files/Git/usr/bin/gpg.exe' : 'gpg';
const hasGpg = spawnSync(gpg, ['--version']).status === 0;
it.skipIf(!hasGpg)('GPG AES256 round-trip rejects the wrong password and tampered ciphertext', () => {
  const {dir, cleanup} = fixture();
  try {
    const home = join(dir,'gnupg').replaceAll('\\','/'); mkdirSync(home, {mode:0o700});
    const plain = join(dir,'test-input.json').replaceAll('\\','/'), encrypted = join(dir,'test.gpg').replaceAll('\\','/');
    const value = JSON.stringify({test:'synthetic-test-data-only'});
    writeFileSync(plain, value);
    const arg = (path: string) => gpg.includes('/Git/usr/bin/') ? path.replace(/^([A-Za-z]):\//, (_, drive: string) => '/' + drive.toLowerCase() + '/') : path;
    const common = ['--homedir',arg(home),'--batch','--no-symkey-cache','--pinentry-mode','loopback','--passphrase-fd','0'];
    const encryptedResult = spawnSync(gpg, [...common,'--symmetric','--cipher-algo','AES256','--output',arg(encrypted),arg(plain)], {input:'synthetic-unit-test-passphrase\n'});
    expect(encryptedResult.status, encryptedResult.stderr.toString()).toBe(0);
    const decrypt = (password: string) => spawnSync(gpg, [...common,'--decrypt',arg(encrypted)], {input:password+'\n'});
    const valid = decrypt('synthetic-unit-test-passphrase');
    expect(valid.status).toBe(0); expect(valid.stdout.toString()).toBe(value);
    expect(decrypt('wrong-test-password').status).not.toBe(0);
    const bytes = readFileSync(encrypted); bytes[bytes.length-3] ^= 1; writeFileSync(encrypted,bytes);
    expect(decrypt('synthetic-unit-test-passphrase').status).not.toBe(0);
  } finally { cleanup(); }
}, 60_000);
