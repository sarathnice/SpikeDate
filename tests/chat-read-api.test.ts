import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1DatabaseLike, D1Statement } from '@/lib/server/db';
const harness = vi.hoisted(() => ({
  user: 'lena',
  db: null as unknown as D1DatabaseLike,
}));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () =>
    harness.user ? { id: harness.user } : new Response('', { status: 401 }),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => harness.db,
  withDatabase: async (run: () => Promise<unknown>) => run(),
}));
vi.mock('@/lib/server/profile-readiness', () => ({
  requireConnectionReady: async () => true,
}));
vi.mock('@/lib/server/notifications', () => ({ notifyUser: async () => {} }));
import { GET, PATCH } from '@/app/api/conversations/[id]/messages/route';
let sqlite: DatabaseSync;
beforeEach(() => {
  harness.user = 'lena';
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE matches(id TEXT,user_a_id TEXT,user_b_id TEXT,status TEXT);
    CREATE TABLE conversations(id TEXT,match_id TEXT);
    CREATE TABLE messages(id TEXT,conversation_id TEXT,sender_id TEXT,body TEXT,delivered_at INTEGER,read_at INTEGER,created_at INTEGER,updated_at INTEGER,deleted_at INTEGER);
    CREATE TABLE message_media(message_id TEXT,kind TEXT,duration_ms INTEGER);
    INSERT INTO matches VALUES ('match','alex','lena','active'),('other-match','alex','third','active');
    INSERT INTO conversations VALUES ('chat','match'),('other','other-match');
    INSERT INTO messages VALUES ('visible','chat','alex','Hello',NULL,NULL,1,1,NULL),('offscreen','chat','alex','Older',NULL,NULL,2,1,NULL),('own','chat','lena','Reply',NULL,NULL,3,1,NULL),('other','other','alex','Private',NULL,NULL,4,1,NULL),('deleted','chat','alex','Deleted',NULL,NULL,5,1,5);`);
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
            success: true,
            results: sqlite.prepare(sql).all(...(params as never[])) as T[],
          };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...(params as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
    batch: async () => [],
  };
});
afterEach(() => sqlite.close());
const context = { params: Promise.resolve({ id: 'chat' }) };
const patch = (messageIds: unknown) =>
  PATCH(
    new Request('http://local/api/conversations/chat/messages', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageIds }),
    }),
    context,
  );
const deliver = (deliveredIds: unknown) =>
  PATCH(
    new Request('http://local/api/conversations/chat/messages', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deliveredIds }),
    }),
    context,
  );
const read = (id: string) =>
  (
    sqlite.prepare('SELECT read_at FROM messages WHERE id = ?').get(id) as {
      read_at: number | null;
    }
  ).read_at;
it('GET loads history without changing read timestamps', async () => {
  expect(
    (
      await GET(
        new Request('http://local/api/conversations/chat/messages'),
        context,
      )
    ).status,
  ).toBe(200);
  expect(read('visible')).toBeNull();
  expect(read('offscreen')).toBeNull();
});
it('acknowledges only specified incoming, nondeleted messages from this conversation', async () => {
  const response = await patch(['visible', 'own', 'other', 'deleted']);
  expect(response.status).toBe(200);
  expect(read('visible')).toBeGreaterThan(0);
  for (const id of ['offscreen', 'own', 'other', 'deleted'])
    expect(read(id)).toBeNull();
  expect(
    ((await response.json()) as { messages: unknown[] }).messages,
  ).toHaveLength(1);
});
it('marks delivery only after the receiving account acknowledges the message', async () => {
  const deliveredAt = (id: string) =>
    (sqlite.prepare('SELECT delivered_at FROM messages WHERE id = ?').get(id) as { delivered_at: number | null }).delivered_at;
  expect(deliveredAt('visible')).toBeNull();
  const response = await deliver(['visible', 'own', 'other', 'deleted']);
  expect(response.status).toBe(200);
  expect(deliveredAt('visible')).toBeGreaterThan(0);
  expect(read('visible')).toBeNull();
  for (const id of ['own', 'other', 'deleted']) expect(deliveredAt(id)).toBeNull();
  const first = deliveredAt('visible');
  await deliver(['visible']);
  expect(deliveredAt('visible')).toBe(first);
  await patch(['visible']);
  expect(read('visible')).toBeGreaterThanOrEqual(first ?? 0);
});
it('repeated acknowledgements retain the original timestamp', async () => {
  await patch(['visible']);
  const before = read('visible');
  await patch(['visible', 'visible']);
  expect(read('visible')).toBe(before);
});
it('rejects unauthenticated and unrelated accounts', async () => {
  harness.user = '';
  expect((await patch(['visible'])).status).toBe(401);
  harness.user = 'third';
  expect((await patch(['visible'])).status).toBe(404);
  expect(read('visible')).toBeNull();
});
it('rejects empty, malformed and oversized batches', async () => {
  for (const ids of [[], [1], [''], Array(81).fill('visible')])
    expect((await patch(ids)).status).toBe(400);
  expect(read('visible')).toBeNull();
});
it('rejects acknowledgements after the match is deactivated', async () => {
  sqlite.exec("UPDATE matches SET status = 'inactive' WHERE id = 'match'");
  expect((await patch(['visible'])).status).toBe(404);
  expect(read('visible')).toBeNull();
});
it('returns the latest 200 messages in chronological order', async () => {
  for (let i = 6; i < 210; i++)
    sqlite
      .prepare('INSERT INTO messages VALUES (?,?,?,?,?,NULL,?,?,NULL)')
      .run(`msg-${i}`, 'chat', 'alex', 'History', i, i, i);
  const response = await GET(
    new Request('http://local/api/conversations/chat/messages'),
    context,
  );
  const messages = (
    (await response.json()) as {
      messages: Array<{ id: string; created_at: number }>;
    }
  ).messages;
  expect(messages).toHaveLength(200);
  expect(messages.at(-1)?.id).toBe('msg-209');
  expect(messages[0].created_at).toBeLessThan(messages[199].created_at);
  expect(read('visible')).toBeNull();
});
