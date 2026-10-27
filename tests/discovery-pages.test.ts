import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { D1DatabaseLike, D1Statement } from '@/lib/server/db';
import { collectDiscoveryPages } from '@/lib/discovery-pages';
const harness = vi.hoisted(() => ({ db: null as unknown as D1DatabaseLike }));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({ id: 'viewer' }),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => harness.db,
  withDatabase: async (fn: () => unknown) => fn(),
}));
import { GET } from '@/app/api/discover/route';
let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const file of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    db.exec(readFileSync('drizzle/' + file, 'utf8'));
  const user = db.prepare(
    "INSERT INTO users(id,email,status,birth_date,terms_version,terms_accepted_at,created_at,updated_at) VALUES (?,?,'active',?,'qa',1,1,1)",
  );
  const profile = db.prepare(
    "INSERT INTO profiles(user_id,display_name,gender,relationship_goal,discovery_location_mode,city,created_at,updated_at) VALUES (?,?,'woman','Dating','anywhere','Atlanta',1,1)",
  );
  user.run('viewer', 'viewer@test.invalid', '1990-01-01');
  profile.run('viewer', 'Viewer');
  db.exec(
    "INSERT INTO preferences(user_id,genders_json,min_age,max_age,max_distance_km,relationship_goals_json,created_at,updated_at) VALUES ('viewer','[]',18,99,1,'[]',1,1)",
  );
  for (let i = 0; i < 698; i++) {
    const id = 'p' + String(i).padStart(4, '0');
    user.run(id, id + '@test.invalid', '1990-01-01');
    profile.run(id, id);
  }
  db.exec('UPDATE profiles SET discoverable=1');
  harness.db = {
    prepare(sql) {
      let values: unknown[] = [];
      const stmt: D1Statement = {
        bind(...args) {
          values = args;
          return stmt;
        },
        async first<T>() {
          return (db.prepare(sql).get(...(values as never[])) ??
            null) as T | null;
        },
        async all() {
          return {
            success: true,
            results: db.prepare(sql).all(...(values as never[])),
          };
        },
        async run() {
          db.prepare(sql).run(...(values as never[]));
          return { success: true, meta: {} };
        },
      };
      return stmt;
    },
    batch: async () => [],
  };
});
afterEach(() => db.close());
const fetchPage = async (path: string) => {
  const response = await GET(new Request('http://local' + path));
  expect(response.status).toBe(200);
  return (await response.json()) as {
    profiles: Array<{ id: string; age: number }>;
    nextCursor: string | null;
  };
};
it('collects every eligible profile beyond both former 50 and 500 ceilings', async () => {
  const result = await collectDiscoveryPages(fetchPage);
  expect(result.profiles).toHaveLength(698);
  expect(new Set(result.profiles.map((p) => p.id)).size).toBe(698);
  expect(result.profiles.some((p) => p.id === 'p0697')).toBe(true);
});
it('keeps pages bounded, stable and free from duplicates when presence changes', async () => {
  const first = await fetchPage('/api/discover?limit=50');
  expect(first.profiles).toHaveLength(50);
  expect(first.nextCursor).toBe('p0049');
  db.exec("UPDATE users SET last_active_at=999999 WHERE id='p0600'");
  const second = await fetchPage(
    '/api/discover?limit=50&cursor=' + first.nextCursor,
  );
  expect(second.profiles[0].id).toBe('p0050');
  expect(second.profiles.at(-1)?.id).toBe('p0099');
});
it('scans past hundreds of excluded candidates while preserving age and safety rules', async () => {
  db.exec(
    "UPDATE users SET birth_date='2020-01-01' WHERE id<'p0600' AND id!='viewer'; UPDATE users SET status='suspended' WHERE id='p0600'; UPDATE profiles SET discoverable=0 WHERE user_id='p0601'; INSERT INTO safety_actions(id,reporter_id,subject_id,kind,created_at,updated_at) VALUES('blocked','viewer','p0602','block',1,1)",
  );
  const result = await collectDiscoveryPages(fetchPage);
  expect(result.profiles).toHaveLength(95);
  expect(result.profiles.every((p) => p.age >= 18)).toBe(true);
  expect(
    result.profiles.some((p) => ['p0600', 'p0601', 'p0602'].includes(p.id)),
  ).toBe(false);
});
it('still respects narrower gender, goal and age preferences', async () => {
  db.exec(
    "UPDATE preferences SET genders_json='[\"man\"]' WHERE user_id='viewer'",
  );
  expect((await collectDiscoveryPages(fetchPage)).profiles).toHaveLength(0);
});
it('rejects malformed pagination and detects repeated server cursors', async () => {
  expect(
    (await GET(new Request('http://local/api/discover?limit=1.5'))).status,
  ).toBe(400);
  await expect(
    collectDiscoveryPages(async () => ({
      profiles: [{ id: 'x' }],
      nextCursor: 'same',
    })),
  ).rejects.toThrow('did not advance');
});
it('cancels stale refreshes without loading further pages', async () => {
  let calls = 0;
  await expect(
    collectDiscoveryPages(
      async () => {
        calls++;
        return { profiles: [{ id: 'x' }], nextCursor: 'next' };
      },
      false,
      () => calls > 0,
    ),
  ).rejects.toThrow('cancelled');
  expect(calls).toBe(1);
});
