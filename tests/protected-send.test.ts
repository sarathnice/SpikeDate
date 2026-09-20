import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1DatabaseLike, D1Statement } from '@/lib/server/db';
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(async () => ({})),
}));
import { notifyUser } from '@/lib/server/notifications';
import { protectedSend } from '@/lib/server/protected-send';
let sqlite: DatabaseSync;
let db: D1DatabaseLike;
beforeEach(() => {
  vi.clearAllMocks();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE interactions(id TEXT PRIMARY KEY,actor_id TEXT,target_id TEXT,kind TEXT,note TEXT,target_type TEXT,target_ref TEXT,idempotency_key TEXT,created_at INTEGER,updated_at INTEGER,undone_at INTEGER, UNIQUE(actor_id,idempotency_key));
    CREATE TABLE entitlement_wallets(user_id TEXT PRIMARY KEY, super_spikes INTEGER CHECK(super_spikes >= 0),version INTEGER,updated_at INTEGER);
    CREATE TABLE entitlement_ledger(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,delta INTEGER,reason TEXT,idempotency_key TEXT UNIQUE,created_at INTEGER,updated_at INTEGER);
    CREATE TABLE matches(id TEXT PRIMARY KEY,user_a_id TEXT,user_b_id TEXT,status TEXT,matched_at INTEGER,created_at INTEGER,updated_at INTEGER,UNIQUE(user_a_id,user_b_id));
    CREATE TABLE conversations(id TEXT PRIMARY KEY,match_id TEXT UNIQUE,created_at INTEGER,updated_at INTEGER);
    CREATE TABLE profiles(user_id TEXT PRIMARY KEY,display_name TEXT);
    INSERT INTO entitlement_wallets VALUES ('alex',3,0,0),('lena',3,0,0);
    INSERT INTO profiles VALUES ('alex','Alex'),('lena','Lena');
  `);
  db = {
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
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  // Serialize batches just as D1 transactions serialize writes across requests.
  const batch = db.batch.bind(db);
  let queue: Promise<unknown> = Promise.resolve();
  db.batch = (statements) => {
    const result = queue.then(() => batch(statements));
    queue = result.catch(() => {});
    return result;
  };
});
afterEach(() => sqlite.close());
let sequence = 0;
const send = (
  kind: 'like' | 'super_spike',
  upgrade = false,
  target = 'lena',
  actor = 'alex',
) =>
  protectedSend(db, actor, {
    targetUserId: target,
    kind,
    upgrade,
    note: 'Hello',
    targetType: 'profile',
    idempotencyKey: `request-${++sequence}`,
  });
const balance = () =>
  Number(
    sqlite
      .prepare(
        "SELECT super_spikes FROM entitlement_wallets WHERE user_id = 'alex'",
      )
      .get()!.super_spikes,
  );
const count = (table: string) =>
  Number(sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n);
it('repeated Likes create one entry and one notification', async () => {
  expect((await send('like')).status).toBe(201);
  expect(await (await send('like')).json()).toMatchObject({
    duplicate: true,
    charged: false,
  });
  expect(count('interactions')).toBe(1);
  expect(balance()).toBe(3);
  expect(notifyUser).toHaveBeenCalledTimes(1);
});
it('Spike → Like and Spike → Spike cannot downgrade or spend again', async () => {
  await send('super_spike');
  for (const kind of ['like', 'super_spike'] as const)
    expect(await (await send(kind)).json()).toMatchObject({
      duplicate: true,
      charged: false,
    });
  expect(balance()).toBe(2);
  expect(count('entitlement_ledger')).toBe(1);
  expect(sqlite.prepare('SELECT kind FROM interactions').get()!.kind).toBe(
    'super_spike',
  );
  expect(notifyUser).toHaveBeenCalledTimes(1);
});
it('requires explicit upgrade, updates the original Like, and charges exactly once', async () => {
  await send('like');
  expect((await send('super_spike')).status).toBe(409);
  expect(balance()).toBe(3);
  expect(await (await send('super_spike', true)).json()).toMatchObject({
    upgraded: true,
    charged: true,
  });
  await send('super_spike', true);
  expect(count('interactions')).toBe(1);
  expect(balance()).toBe(2);
  expect(count('entitlement_ledger')).toBe(1);
});
it('simultaneous duplicate Spikes with different request IDs debit once', async () => {
  const responses = await Promise.all([
    send('super_spike'),
    send('super_spike'),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
  expect(balance()).toBe(2);
  expect(count('interactions')).toBe(1);
  expect(count('entitlement_ledger')).toBe(1);
  expect(notifyUser).toHaveBeenCalledTimes(1);
});
it('simultaneous upgrades debit once', async () => {
  await send('like');
  await Promise.all([send('super_spike', true), send('super_spike', true)]);
  expect(balance()).toBe(2);
  expect(count('interactions')).toBe(1);
  expect(count('entitlement_ledger')).toBe(1);
});
it('two targets competing for the last Spike cannot create an unpaid send', async () => {
  sqlite.exec(
    "UPDATE entitlement_wallets SET super_spikes = 1 WHERE user_id = 'alex'",
  );
  const responses = await Promise.all([
    send('super_spike'),
    send('super_spike', false, 'maya'),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(balance()).toBe(0);
  expect(count('interactions')).toBe(1);
  expect(count('entitlement_ledger')).toBe(1);
});
it('a failed transaction rolls back send, ledger and debit', async () => {
  sqlite.exec(
    "CREATE TRIGGER reject_debit BEFORE UPDATE ON entitlement_wallets BEGIN SELECT RAISE(ABORT, 'simulated failure'); END",
  );
  await expect(send('super_spike')).rejects.toThrow('simulated failure');
  expect(balance()).toBe(3);
  expect(count('interactions')).toBe(0);
  expect(count('entitlement_ledger')).toBe(0);
  expect(notifyUser).not.toHaveBeenCalled();
});
it('reciprocal sends create one match/conversation; matched sends never charge', async () => {
  await send('like');
  await send('like', false, 'alex', 'lena');
  expect(count('matches')).toBe(1);
  expect(count('conversations')).toBe(1);
  expect(await (await send('super_spike')).json()).toMatchObject({
    duplicate: true,
    charged: false,
    match: { id: expect.any(String) },
  });
  expect(balance()).toBe(3);
});
it('notification delivery failure does not report a committed send as failed', async () => {
  vi.mocked(notifyUser).mockRejectedValueOnce(new Error('delivery failed'));
  expect((await send('super_spike')).status).toBe(201);
  expect(balance()).toBe(2);
});
