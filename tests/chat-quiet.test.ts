import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { D1DatabaseLike, D1Statement } from '@/lib/server/db';
import { conversationStarters } from '@/lib/chat-quiet';
const harness = vi.hoisted(() => ({
  user: 'a',
  ready: true,
  db: null as unknown as D1DatabaseLike,
}));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () =>
    harness.user ? { id: harness.user } : new Response('', { status: 401 }),
}));
vi.mock('@/lib/server/profile-readiness', () => ({
  requireConnectionReady: async () => harness.ready,
}));
vi.mock('@/lib/server/db', () => ({
  withDatabase: async (fn: (db: D1DatabaseLike) => Promise<Response>) =>
    fn(harness.db),
}));
import { GET, PUT } from '@/app/api/conversations/[id]/reactions/route';
let sqlite: DatabaseSync;
beforeEach(() => {
  harness.user = 'a';
  harness.ready = true;
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES ('a'),('b'),('c');
    CREATE TABLE matches(id TEXT,user_a_id TEXT,user_b_id TEXT,status TEXT);
    CREATE TABLE conversations(id TEXT,match_id TEXT);
    CREATE TABLE messages(id TEXT PRIMARY KEY,conversation_id TEXT,deleted_at INTEGER);
    INSERT INTO matches VALUES ('m','a','b','active'),('x','b','c','active');
    INSERT INTO conversations VALUES ('chat','m'),('other','x');
    INSERT INTO messages VALUES ('one','chat',NULL),('gone','chat',1),('private','other',NULL);`);
  sqlite.exec(readFileSync('drizzle/0016_message_reactions.sql', 'utf8'));
  harness.db = {
    prepare(sql) {
      let values: unknown[] = [];
      const statement: D1Statement = {
        bind(...args) {
          values = args;
          return statement;
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...(values as never[])) ??
            null) as T | null;
        },
        async all() {
          return {
            success: true,
            results: sqlite.prepare(sql).all(...(values as never[])),
          };
        },
        async run() {
          sqlite.prepare(sql).run(...(values as never[]));
          return { success: true, meta: {} };
        },
      };
      return statement;
    },
    batch: async () => [],
  };
});
afterEach(() => sqlite.close());
const context = { params: Promise.resolve({ id: 'chat' }) };
const put = (emoji: unknown, messageId = 'one') =>
  PUT(
    new Request('http://local/api/conversations/chat/reactions', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId, emoji }),
    }),
    context,
  );
const get = () =>
  GET(new Request('http://local/api/conversations/chat/reactions'), context);
it('persists one reaction per participant, replaces idempotently and removes only your own', async () => {
  expect((await put('❤️')).status).toBe(200);
  await put('❤️');
  await put('😂');
  harness.user = 'b';
  await put('😂');
  expect(await (await get()).json()).toEqual({
    reactions: [{ message_id: 'one', emoji: '😂', count: 2, mine: 1 }],
  });
  await put(null);
  expect(await (await get()).json()).toEqual({
    reactions: [{ message_id: 'one', emoji: '😂', count: 1, mine: 0 }],
  });
});
it('rejects unauthenticated, unrelated, inactive and unready reaction writes', async () => {
  harness.user = '';
  expect((await put('❤️')).status).toBe(401);
  harness.user = 'c';
  expect((await get()).status).toBe(404);
  expect((await put('❤️')).status).toBe(404);
  harness.user = 'a';
  harness.ready = false;
  expect((await put('❤️')).status).toBe(403);
  harness.ready = true;
  sqlite.exec("UPDATE matches SET status = 'inactive' WHERE id = 'm'");
  expect((await put('❤️')).status).toBe(404);
});
it('rejects unsupported emojis, wrong conversation messages and deleted messages', async () => {
  expect((await put('💰')).status).toBe(400);
  expect((await put('❤️', 'private')).status).toBe(404);
  expect((await put('❤️', 'gone')).status).toBe(404);
  expect(await (await get()).json()).toEqual({ reactions: [] });
});
it('produces local music, coffee and neutral suggestions without inventing personal facts', () => {
  expect(conversationStarters('I love jazz')[0]).toContain('listening');
  expect(conversationStarters('coffee?')[0]).toContain('coffee');
  expect(conversationStarters('hello')).toEqual(conversationStarters());
});
