import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1DatabaseLike, D1Statement } from '@/lib/server/db';
import { cameraQualityMessage } from '@/lib/camera-quality';

const harness = vi.hoisted(() => ({
  user: 'alice',
  mode: 'mock',
  db: null as unknown as D1DatabaseLike,
}));
vi.mock('cloudflare:workers', () => ({
  env: {
    get SPIKEDATE_FACE_VERIFICATION_MODE() {
      return harness.mode;
    },
  },
}));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () =>
    harness.user ? { id: harness.user } : new Response('', { status: 401 }),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => harness.db,
  withDatabase: async (run: () => Promise<unknown>) => run(),
}));
import { GET, POST, DELETE } from '@/app/api/verification/route';

let sqlite: DatabaseSync;
beforeEach(() => {
  harness.user = 'alice';
  harness.mode = 'mock';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-17T20:00:00Z'));
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY, phone_verified_at INTEGER);
    CREATE TABLE profiles(user_id TEXT PRIMARY KEY,verification_status TEXT,completed_at INTEGER,discoverable_requested INTEGER,discoverable INTEGER,updated_at INTEGER);
    CREATE TABLE profile_media(user_id TEXT,type TEXT,moderation_status TEXT);
    CREATE TABLE verification_requests(id TEXT PRIMARY KEY,user_id TEXT,provider TEXT,provider_ref TEXT,status TEXT,submitted_at INTEGER,reviewed_at INTEGER,created_at INTEGER,updated_at INTEGER);
    INSERT INTO users VALUES ('alice',1),('bob',1);
    INSERT INTO profiles VALUES ('alice','unverified',1,1,0,1),('bob','unverified',1,1,0,1);
    INSERT INTO profile_media VALUES ('alice','photo','approved');
  `);
  harness.db = {
    prepare(sql) {
      let params: unknown[] = [];
      const statement: D1Statement = {
        bind(...values) {
          params = values;
          return statement;
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...(params as never[])) ??
            null) as T | null;
        },
        async all<T>() {
          return {
            results: sqlite.prepare(sql).all(...(params as never[])) as T[],
            success: true,
          };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...(params as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const result = await Promise.all(statements.map((s) => s.run()));
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
});
afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
});
function request(data: unknown, host = '127.0.0.1') {
  return new Request(`http://${host}/api/verification`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
}
const metrics = {
  brightness: 130,
  sharpness: 20,
  faceCount: 1,
  frameCount: 1,
  captureDigest: 'a'.repeat(64),
};
async function start(host?: string) {
  const response = await POST(
    request({ action: 'start', consent: true }, host),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { request: { id: string } }).request.id;
}
function profile() {
  return sqlite.prepare('SELECT * FROM profiles WHERE user_id=?').get('alice');
}
async function statusOf(response: Response) {
  return ((await response.json()) as { status: string }).status;
}

it('requires authentication, explicit consent and a saved profile', async () => {
  expect(
    (await POST(request({ action: 'start', consent: false }))).status,
  ).toBe(400);
  harness.user = '';
  expect((await POST(request({ action: 'start', consent: true }))).status).toBe(
    401,
  );
  harness.user = 'unknown';
  expect((await POST(request({ action: 'start', consent: true }))).status).toBe(
    409,
  );
});
it('even forged perfect client metrics never issue a badge or discovery access', async () => {
  const id = await start();
  const response = await POST(
    request({ action: 'complete', requestId: id, metrics }),
  );
  const result = await response.json();
  expect(result).toMatchObject({
    status: 'capture_ready',
    retainedImage: false,
    identityVerificationConfigured: false,
    readiness: { ready: false, photoVerified: false, discoverable: false },
  });
  expect(profile()).toMatchObject({
    verification_status: 'capture_ready',
    discoverable: 0,
  });
  expect(
    sqlite.prepare('SELECT * FROM verification_requests WHERE id=?').get(id),
  ).toMatchObject({
    provider: 'on-device-face-detection',
    provider_ref: 'consent-v2-on-device;capture-sha256:' + 'a'.repeat(64),
    reviewed_at: null,
  });
  expect(
    await statusOf(await GET(new Request('http://local/api/verification'))),
  ).toBe('capture_ready');
  expect(
    (await POST(request({ action: 'complete', requestId: id, metrics })))
      .status,
  ).toBe(409);
});
it.each([null, 0, 2])(
  'rejects absent/unknown/multiple face detection (%s)',
  async (faceCount) => {
    const id = await start();
    expect(
      await statusOf(
        await POST(
          request({
            action: 'complete',
            requestId: id,
            metrics: { ...metrics, faceCount },
          }),
        ),
      ),
    ).toBe('needs_retry');
    expect(profile()).toMatchObject({ discoverable: 0 });
  },
);
it.each([{ brightness: 20 }, { brightness: 240 }, { sharpness: 2 }])(
  'rejects insufficient capture quality (%j)',
  async (change) => {
    const id = await start();
    expect(
      await statusOf(
        await POST(
          request({
            action: 'complete',
            requestId: id,
            metrics: { ...metrics, ...change },
          }),
        ),
      ),
    ).toBe('needs_retry');
  },
);
it('isolates accounts, expires stale captures and does not leave a pending profile', async () => {
  const id = await start();
  harness.user = 'bob';
  expect(
    (await POST(request({ action: 'complete', requestId: id, metrics })))
      .status,
  ).toBe(409);
  harness.user = 'alice';
  vi.advanceTimersByTime(300001);
  expect(
    (await POST(request({ action: 'complete', requestId: id, metrics })))
      .status,
  ).toBe(410);
  expect(profile()).toMatchObject({
    verification_status: 'needs_retry',
    discoverable: 0,
  });
});
it('cancels without completing a check, permits retry and enforces daily attempts', async () => {
  const id = await start();
  expect(
    (await POST(request({ action: 'cancel', requestId: id }))).status,
  ).toBe(200);
  expect(profile()).toMatchObject({ verification_status: 'unverified' });
  expect(
    (await POST(request({ action: 'complete', requestId: id, metrics })))
      .status,
  ).toBe(409);
  await start();
  await start();
  expect((await POST(request({ action: 'start', consent: true }))).status).toBe(
    429,
  );
});
it('public hosts cannot use mock verification and disabled mode fails closed', async () => {
  const id = await start('spikedate-stage.sarathnice.workers.dev');
  expect(
    await (
      await POST(
        request(
          { action: 'complete', requestId: id, metrics },
          'spikedate-stage.sarathnice.workers.dev',
        ),
      )
    ).json(),
  ).toMatchObject({ status: 'capture_ready', testMode: false });
  harness.mode = 'disabled';
  expect((await POST(request({ action: 'start', consent: true }))).status).toBe(
    503,
  );
});
it('withdrawal deletes only the signed-in account data and removes discoverability', async () => {
  await start();
  harness.user = 'bob';
  await start();
  harness.user = 'alice';
  expect(
    (
      await DELETE(
        new Request('http://local/api/verification', { method: 'DELETE' }),
      )
    ).status,
  ).toBe(200);
  expect(
    sqlite
      .prepare(
        'SELECT COUNT(*) AS count FROM verification_requests WHERE user_id=?',
      )
      .get('alice')?.count,
  ).toBe(0);
  expect(
    sqlite
      .prepare(
        'SELECT COUNT(*) AS count FROM verification_requests WHERE user_id=?',
      )
      .get('bob')?.count,
  ).toBe(1);
  expect(profile()).toMatchObject({
    verification_status: 'unverified',
    discoverable: 0,
  });
});
it('never downgrades an already verified profile by starting an unnecessary capture', async () => {
  sqlite.exec(
    "UPDATE profiles SET verification_status='photo_verified',discoverable=1 WHERE user_id='alice'",
  );
  expect((await POST(request({ action: 'start', consent: true }))).status).toBe(
    409,
  );
  expect(profile()).toMatchObject({
    verification_status: 'photo_verified',
    discoverable: 1,
  });
});
it('returns actionable capture hints and never passes unsupported detection', () => {
  expect(cameraQualityMessage(metrics)).toBe('');
  expect(cameraQualityMessage({ ...metrics, faceCount: null })).toContain(
    'unavailable',
  );
  expect(cameraQualityMessage({ ...metrics, faceCount: 2 })).toContain(
    'Only one',
  );
});
