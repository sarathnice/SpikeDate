import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTests, renderReport, validateTarget } from './report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const options = {
  url: 'http://127.0.0.1:3002',
  mode: 'smoke',
  profiles: undefined,
  open: false,
  retry: false,
};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help') {
    console.log(
      'npm run qa -- [--url LOCAL_OR_APPROVED_STAGE_ORIGIN] [--mode smoke|full|photos] [--profiles 1..50] [--open] [--retry]\nDefault: smoke, local port 3002, 3 profile audits/device. Full and photos default to 50 profiles/device. Never resets DB or deploys.',
    );
    process.exit(0);
  }
  if (arg === '--open' || arg === '--retry') options[arg.slice(2)] = true;
  else if (['--url', '--mode', '--profiles'].includes(arg) && args[i + 1])
    options[arg.slice(2)] = args[++i];
  else throw new Error(`Unknown or incomplete argument: ${arg}`);
}
options.url = validateTarget(options.url);
if (!['smoke', 'full', 'photos'].includes(options.mode))
  throw new Error('Mode must be smoke, full or photos.');
const profiles = Number(
  options.profiles ?? (options.mode === 'smoke' ? 3 : 50),
);
if (!Number.isInteger(profiles) || profiles < 1 || profiles > 60)
  throw new Error('Profiles must be an integer from 1 to 60.');
const startedAt = new Date().toISOString();
const dir = path.join(
  root,
  'outputs',
  'qa',
  startedAt.replace(/[:.]/g, '-') + '-' + process.pid,
);
await mkdir(dir, { recursive: true });
const env = {
  ...process.env,
  SPIKEDATE_UI_URL: options.url,
  SPIKEDATE_QA_REPORT_DIR: dir,
  SPIKEDATE_QA_PROFILES: String(profiles),
  SPIKEDATE_QA_RETRIES: options.retry ? '1' : '0',
};
const summary = {
  startedAt,
  url: options.url,
  mode: options.mode,
  profilesPerDevice: profiles,
  status: 'RUNNING',
  steps: [],
  tests: [],
};
try {
  summary.workspaceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  summary.workspaceDirty = Boolean(
    execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    }).trim(),
  );
} catch {
  summary.workspaceCommit = 'unavailable';
}
async function save() {
  await writeFile(
    path.join(dir, 'summary.json'),
    JSON.stringify(summary, null, 2),
  );
  await writeFile(path.join(dir, 'index.html'), renderReport(summary));
}
async function run(name, relativeScript, argumentsList) {
  const start = Date.now();
  const log = `${summary.steps.length + 1}-${name.replace(/[^a-z0-9]+/gi, '-')}.log`;
  let output = '';
  console.log(`\n[QA] ${name}`);
  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(root, relativeScript), ...argumentsList],
      { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const add = (data) => {
      output += data;
      process.stdout.write(data);
    };
    child.stdout.on('data', add);
    child.stderr.on('data', add);
    child.on('error', (error) => {
      output += error.message;
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
  await writeFile(path.join(dir, log), output);
  summary.steps.push({
    name,
    status: code === 0 ? 'passed' : 'failed',
    exitCode: code,
    seconds: Math.round((Date.now() - start) / 1000),
    log,
  });
  await save();
  return code === 0;
}
await save();
try {
  const response = await fetch(options.url, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);
  void response.body?.cancel().catch(() => undefined);
  summary.steps.push({
    name: 'Target reachable',
    status: 'passed',
    seconds: 0,
    log: 'target.log',
  });
  await writeFile(
    path.join(dir, 'target.log'),
    `HTTP ${response.status} ${options.url}`,
  );
  if (options.mode !== 'photos') {
    await run('Lint', 'node_modules/oxlint/bin/oxlint', []);
    await run('Type check', 'node_modules/typescript/bin/tsc', ['--noEmit']);
    await run('Unit tests', 'node_modules/vitest/vitest.mjs', ['run']);
    await run('QA reporter tests', 'tests/qa/report.test.mjs', []);
  }
  const ui = ['test'];
  if (options.mode === 'photos')
    ui.push('tests/playwright/profile-audit.spec.ts');
  else if (options.mode === 'smoke')
    ui.push(
      '--grep',
      'Galaxy, Likes|Today composer|profile audit|cross-account|profile photo crop|photo upload:|profile typography:',
    );
  if (options.mode === 'full')
    await run('Staging build', 'node_modules/cross-env/dist/bin/cross-env.js', [
      'NEXT_PUBLIC_SPIKEDATE_SERVER_DATA_ENABLED=true',
      'NEXT_PUBLIC_SPIKEDATE_DATE_PLANS_ENABLED=true',
      'node',
      'node_modules/vinext/dist/cli.js',
      'build',
    ]);
  await run('Mobile browser tests', 'node_modules/@playwright/test/cli.js', ui);
  try {
    summary.tests = collectTests(
      JSON.parse(await readFile(path.join(dir, 'playwright.json'), 'utf8')),
    );
  } catch {
    summary.steps.push({
      name: 'Browser results available',
      status: 'failed',
      seconds: 0,
      log: 'target.log',
    });
  }
} catch (error) {
  await writeFile(path.join(dir, 'error.log'), error.stack ?? error.message);
  summary.steps.push({
    name: 'Runner or target error',
    status: 'failed',
    seconds: 0,
    log: 'error.log',
  });
}
summary.finishedAt = new Date().toISOString();
summary.status =
  summary.steps.some((s) => s.status !== 'passed') ||
  !summary.tests.length ||
  summary.tests.some((t) => t.status === 'unexpected' || t.status === 'flaky')
    ? 'FAILED'
    : summary.tests.some((t) => t.status === 'skipped')
      ? 'INCOMPLETE'
      : 'PASSED';
await save();
await writeFile(
  path.join(root, 'outputs', 'qa', 'latest.json'),
  JSON.stringify(
    { report: path.join(dir, 'index.html'), status: summary.status },
    null,
    2,
  ),
);
console.log(
  `\n[QA] ${summary.status}\nReport: ${path.join(dir, 'index.html')}`,
);
if (options.open && process.platform === 'win32') {
  spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Invoke-Item -LiteralPath $env:SPIKEDATE_QA_HTML',
    ],
    {
      env: { ...env, SPIKEDATE_QA_HTML: path.join(dir, 'index.html') },
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    },
  ).unref();
}
process.exitCode = summary.status === 'PASSED' ? 0 : 1;
