import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { D1DatabaseLike, D1Statement } from '@/lib/server/db';
const harness = vi.hoisted(() => ({
  user: 'alex',
  session: 'alex-session',
  db: null as unknown as D1DatabaseLike,
}));
vi.mock('@/lib/server/auth', () => ({
  currentUser: async () =>
    harness.user ? { id: harness.user, sessionId: harness.session } : null,
  requireUser: async () =>
    harness.user
      ? { id: harness.user, sessionId: harness.session }
      : new Response('', { status: 401 }),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => harness.db,
  withDatabase: async (run: () => Promise<unknown>) => run(),
}));
import { GET, POST, DELETE, PATCH } from '@/app/api/presence/route';
let sqlite: DatabaseSync;
const clientA = '00000000-0000-4000-8000-000000000001';
const clientB = '00000000-0000-4000-8000-000000000002';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-17T20:00:00Z'));
  harness.user = 'alex';
  harness.session = 'alex-session';
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT,last_active_at INTEGER);
    CREATE TABLE profiles(user_id TEXT PRIMARY KEY,discoverable INTEGER);
    CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,revoked_at INTEGER,expires_at INTEGER);
    CREATE TABLE matches(user_a_id TEXT,user_b_id TEXT,status TEXT);
    CREATE TABLE safety_actions(reporter_id TEXT,subject_id TEXT,kind TEXT);
    INSERT INTO users VALUES ('alex','active',${Date.now()}),('lena','active',${Date.now()}),('private','active',${Date.now()});
    INSERT INTO profiles VALUES ('alex',1),('lena',1),('private',0);
    INSERT INTO sessions VALUES ('alex-session','alex',NULL,${Date.now() + 3600000}),('second-session','alex',NULL,${Date.now() + 3600000});
  `);
  sqlite.exec(readFileSync('drizzle/0007_flippant_forgotten_one.sql', 'utf8'));
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
function request(method: string, body: unknown) {
  return new Request('http://local/api/presence', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function state(id = 'alex') {
  const response = await GET(
    new Request(`http://local/api/presence?ids=${id}`),
  );
  const data = (await response.json()) as {
    presence: import('@/lib/presence').LivePresenceState[];
  };
  return data.presence[0];
}
it('publishes a server-timed heartbeat and expires it after 90 seconds', async () => {
  expect(
    (
      await POST(
        request('POST', { clientId: clientA, lastSeenAt: Date.now() + 999999 }),
      )
    ).status,
  ).toBe(200);
  harness.user = 'lena';
  expect(await state()).toMatchObject({
    state: 'online',
    onlineUntil: Date.now() + 90000,
  });
  vi.advanceTimersByTime(90000);
  expect(await state()).toMatchObject({ state: 'recent', onlineUntil: null });
  vi.advanceTimersByTime(15 * 60000);
  expect(await state()).toMatchObject({ state: 'offline' });
});
it('keeps another tab online when one tab leaves', async () => {
  await POST(request('POST', { clientId: clientA }));
  await POST(request('POST', { clientId: clientB }));
  await DELETE(request('DELETE', { clientId: clientA }));
  expect((await state()).state).toBe('online');
  await DELETE(request('DELETE', { clientId: clientB }));
  expect((await state()).state).toBe('recent');
});
it('isolates devices and does not let another session delete presence', async () => {
  await POST(request('POST', { clientId: clientA }));
  harness.session = 'second-session';
  await DELETE(request('DELETE', { clientId: clientA }));
  expect((await state()).state).toBe('online');
  await POST(request('POST', { clientId: clientB }));
  sqlite.exec("UPDATE sessions SET revoked_at = 1 WHERE id = 'alex-session'");
  expect((await state()).state).toBe('online');
  sqlite.exec("UPDATE sessions SET revoked_at = 1 WHERE id = 'second-session'");
  expect((await state()).state).toBe('recent');
});
it('ignores expired sessions', async () => {
  await POST(request('POST', { clientId: clientA }));
  sqlite
    .prepare("UPDATE sessions SET expires_at = ? WHERE id = 'alex-session'")
    .run(Date.now());
  expect((await state()).state).toBe('recent');
});
it('hides live and recent activity on every device, persists the preference and prevents renewal', async () => {
  await POST(request('POST', { clientId: clientA }));
  harness.session = 'second-session';
  await POST(request('POST', { clientId: clientB }));
  expect((await PATCH(request('PATCH', { showOnline: false }))).status).toBe(
    200,
  );
  const preference = await GET(new Request('http://local/api/presence'));
  expect(await preference.json()).toEqual({ showOnline: false });
  await POST(request('POST', { clientId: clientB }));
  harness.user = 'lena';
  expect(await state()).toEqual({
    id: 'alex',
    state: 'hidden',
    onlineUntil: null,
    lastActiveAt: null,
  });
  expect(
    sqlite.prepare('SELECT COUNT(*) AS count FROM live_presence').get(),
  ).toEqual({ count: 0 });
  harness.user = 'alex';
  await PATCH(request('PATCH', { showOnline: true }));
  await POST(request('POST', { clientId: clientB }));
  expect((await state()).state).toBe('online');
});
it('does not reveal blocked, unknown or non-discoverable unmatched users', async () => {
  await POST(request('POST', { clientId: clientA }));
  harness.user = 'lena';
  sqlite.exec("INSERT INTO safety_actions VALUES ('alex','lena','block')");
  for (const id of ['alex', 'private', 'unknown']) {
    expect(await state(id)).toEqual({
      id,
      state: 'hidden',
      onlineUntil: null,
      lastActiveAt: null,
    });
  }
});
it('allows presence for a non-discoverable active match', async () => {
  sqlite.exec("INSERT INTO matches VALUES ('alex','private','active')");
  expect((await state('private')).state).toBe('recent');
});
it('rejects anonymous access and invalid payloads or oversized batches', async () => {
  expect((await POST(request('POST', { clientId: 'bad' }))).status).toBe(400);
  expect((await PATCH(request('PATCH', { showOnline: 'yes' }))).status).toBe(
    400,
  );
  const ids = Array.from({ length: 51 }, (_, n) => String(n)).join(',');
  expect(
    (await GET(new Request(`http://local/api/presence?ids=${ids}`))).status,
  ).toBe(400);
  harness.user = '';
  expect((await GET(new Request('http://local/api/presence'))).status).toBe(
    401,
  );
  expect((await POST(request('POST', { clientId: clientA }))).status).toBe(401);
  expect((await DELETE(request('DELETE', { clientId: clientA }))).status).toBe(
    401,
  );
  expect((await PATCH(request('PATCH', { showOnline: true }))).status).toBe(
    401,
  );
});
it('throttles repeated heartbeat writes without extending timestamps incorrectly', async () => {
  await POST(request('POST', { clientId: clientA }));
  const first = (await state()).onlineUntil;
  vi.advanceTimersByTime(1000);
  await POST(request('POST', { clientId: clientA }));
  expect((await state()).onlineUntil).toBe(first);
  vi.advanceTimersByTime(30000);
  await POST(request('POST', { clientId: clientA }));
  expect((await state()).onlineUntil).toBe(Date.now() + 90000);
});
