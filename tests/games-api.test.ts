import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { D1DatabaseLike, D1Statement } from '@/lib/server/db';
const harness = vi.hoisted(() => ({
  user: 'alex',
  db: null as unknown as D1DatabaseLike,
}));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({ id: harness.user }),
}));
vi.mock('@/lib/server/profile-readiness', () => ({
  requireConnectionReady: async () => true,
}));
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(async () => ({ queued: true })),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => harness.db,
  withDatabase: async (operation: () => Promise<unknown>) => operation(),
}));
import { GET, POST } from '@/app/api/conversations/[id]/games/route';
import type { GameView } from '@/lib/games';
let sqlite: DatabaseSync;
beforeEach(() => {
  harness.user = 'alex';
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY); CREATE TABLE matches(id TEXT PRIMARY KEY,user_a_id TEXT,user_b_id TEXT,status TEXT); CREATE TABLE conversations(id TEXT PRIMARY KEY,match_id TEXT); INSERT INTO users VALUES ('alex'),('lena'),('intruder'); INSERT INTO matches VALUES ('match','alex','lena','active'); INSERT INTO conversations VALUES ('chat','match');",
  );
  sqlite.exec(readFileSync('drizzle/0006_tiny_marvel_apes.sql', 'utf8'));
  harness.db = {
    prepare(sql: string) {
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
      return Promise.all(statements.map((s) => s.run()));
    },
  };
});
afterEach(() => sqlite.close());
const context = { params: Promise.resolve({ id: 'chat' }) };
async function act(body: Record<string, unknown>) {
  return POST(
    new Request('http://local/api/conversations/chat/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  );
}
async function view() {
  const response = await GET(
    new Request('http://local/api/conversations/chat/games'),
    context,
  );
  return (await response.json()) as { game: GameView };
}
async function invite() {
  const response = await act({ action: 'invite', gameId: 'this-or-that' });
  expect(response.status).toBe(200);
  return ((await response.json()) as { game: GameView }).game.session.id;
}
it('real SQLite migration: invitation, recipient-only acceptance, private answers, all rounds, persistence and completion', async () => {
  const id = await invite();
  expect((await act({ action: 'accept', sessionId: id })).status).toBe(403);
  harness.user = 'lena';
  expect((await act({ action: 'accept', sessionId: id })).status).toBe(200);
  const options = [
    ['Coffee', 'Dessert'],
    ['By the sea', 'In the mountains'],
    ['Live music', 'A movie'],
  ];
  for (let round = 0; round < 3; round++) {
    harness.user = 'alex';
    expect(
      (
        await act({
          action: 'answer',
          sessionId: id,
          round,
          answer: options[round][0],
        })
      ).status,
    ).toBe(200);
    harness.user = 'lena';
    const hidden = await view();
    expect(hidden.game.reveals).toHaveLength(round);
    expect(hidden.game.ownAnswer).toBeUndefined();
    expect(
      (
        await act({
          action: 'answer',
          sessionId: id,
          round,
          answer: options[round][1],
        })
      ).status,
    ).toBe(200);
    expect((await view()).game.reveals).toHaveLength(round + 1);
  }
  expect((await view()).game.session.status).toBe('completed');
  expect(
    sqlite.prepare('SELECT COUNT(*) AS n FROM game_answers').get()?.n,
  ).toBe(6);
  expect(
    (
      await act({
        action: 'answer',
        sessionId: id,
        round: 2,
        answer: 'A movie',
      })
    ).status,
  ).toBe(409);
  expect((await act({ action: 'invite', gameId: 'emoji-story' })).status).toBe(
    200,
  );
});
it('enforces one active invitation and idempotent answers, including malformed and out-of-turn choices', async () => {
  const id = await invite();
  expect((await act({ action: 'invite', gameId: 'emoji-story' })).status).toBe(
    409,
  );
  expect(
    (await act({ action: 'answer', sessionId: id, round: 0, answer: 'Coffee' }))
      .status,
  ).toBe(409);
  harness.user = 'lena';
  await act({ action: 'accept', sessionId: id });
  expect(
    (
      await act({
        action: 'answer',
        sessionId: id,
        round: 1,
        answer: 'By the sea',
      })
    ).status,
  ).toBe(409);
  expect(
    (await act({ action: 'answer', sessionId: id, round: 0, answer: 'BAD' }))
      .status,
  ).toBe(409);
  await act({ action: 'answer', sessionId: id, round: 0, answer: 'Coffee' });
  await act({ action: 'answer', sessionId: id, round: 0, answer: 'Dessert' });
  expect(sqlite.prepare('SELECT answer FROM game_answers').get()?.answer).toBe(
    'Coffee',
  );
  expect(
    (await act({ action: 'answer', sessionId: id, round: 0, answer: '' }))
      .status,
  ).toBe(400);
});
it('denies intruders, blocked matches and unmatches without returning game answers', async () => {
  await invite();
  harness.user = 'intruder';
  expect((await GET(new Request('http://local'), context)).status).toBe(404);
  expect((await act({ action: 'invite', gameId: 'emoji-story' })).status).toBe(
    404,
  );
  harness.user = 'alex';
  for (const status of ['blocked', 'unmatched']) {
    sqlite.prepare('UPDATE matches SET status = ?').run(status);
    const response = await GET(new Request('http://local'), context);
    expect(response.status).toBe(404);
    expect(await response.json()).not.toHaveProperty('game');
  }
});
it('supports decline, leave, skip and expiry without affecting the match', async () => {
  const id = await invite();
  harness.user = 'lena';
  await act({ action: 'decline', sessionId: id });
  expect((await view()).game.session.status).toBe('declined');
  harness.user = 'alex';
  const next = await invite();
  harness.user = 'lena';
  await act({ action: 'accept', sessionId: next });
  await act({
    action: 'answer',
    sessionId: next,
    round: 0,
    answer: '[Skipped]',
  });
  await act({ action: 'leave', sessionId: next });
  expect((await view()).game.session.status).toBe('left');
  harness.user = 'alex';
  await invite();
  sqlite.exec('UPDATE game_sessions SET expires_at = 0');
  expect((await view()).game.session.status).toBe('expired');
  expect(sqlite.prepare('SELECT status FROM matches').get()?.status).toBe(
    'active',
  );
  expect((await act({ action: 'invite', gameId: 'not-real' })).status).toBe(
    400,
  );
});
