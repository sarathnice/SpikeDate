import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorized: true,
  bindings: [] as Array<{ sql: string; values: unknown[] }>,
  writes: [] as string[],
}));
vi.mock('cloudflare:workers', () => ({ env: {} }));
vi.mock('@/lib/server/admin', () => ({
  requireAdmin: async () => state.authorized
    ? { user: { id: 'staff-001' }, roles: ['super_admin'] }
    : new Response(null, { status: 403 }),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => ({
    prepare(sql: string) {
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) { statement.values = values; state.bindings.push({ sql, values }); return statement; },
        async first() {
          if (sql === 'SELECT COUNT(*) AS count FROM users') return { count: 56 };
          if (sql.includes('COUNT(*)') && sql.includes('FROM users LEFT JOIN')) return { count: 31 };
          if (sql.includes('COUNT(*)') && sql.includes('WHERE status = ?')) return { count: 48 };
          return null;
        },
        async all() { return { results: [{ id: 'member-030', email: 'person@example.test', status: 'active' }] }; },
        async run() { state.writes.push(sql); return { success: true }; },
      };
      return statement;
    },
  }),
  withDatabase: async (run: () => Promise<unknown>) => run(),
}));
vi.mock('@/lib/server/http', () => ({
  readJson: async (request: Request) => request.json(),
  json: (body: unknown, options?: { status?: number }) => Response.json(body, { status: options?.status ?? 200 }),
  identifier: () => 'audit-1',
}));
import { GET as directory } from '@/app/api/admin/operations/route';
import { POST as assistant } from '@/app/api/admin/assistant/route';

beforeEach(() => { state.authorized = true; state.bindings = []; state.writes = []; });

it('returns a total and real offset for page 2 with matching filters', async () => {
  const response = await directory(new Request('http://local/api/admin/operations?view=users&page=2&status=active&verification=verified&q=Maya'));
  const body = await response.json() as { total: number; allTotal: number; page: number; pages: number; rows: unknown[] };
  expect(response.status).toBe(200);
  expect(body).toMatchObject({ total: 31, allTotal: 56, page: 2, pages: 2 });
  expect(body.rows).toHaveLength(1);
  const list = state.bindings.find((item) => item.sql.includes('ORDER BY users.created_at'));
  expect(list?.values.slice(-2)).toEqual([25, 25]);
  expect(list?.values).toContain('active');
  expect(list?.values).toContain('verified');
});

it('rejects invalid directory filters and unauthorized reads', async () => {
  expect((await directory(new Request('http://local/api/admin/operations?view=users&page=-1'))).status).toBe(400);
  expect((await directory(new Request('http://local/api/admin/operations?view=users&status=unknown'))).status).toBe(400);
  state.authorized = false;
  expect((await directory(new Request('http://local/api/admin/operations?view=users'))).status).toBe(403);
});

it('answers total and active people questions from database counts', async () => {
  const ask = (question: string) => assistant(new Request('http://local/api/admin/assistant', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }),
  }));
  const total = await (await ask('How many all people?')).json() as { answer: string };
  expect(total.answer).toContain('56 total accounts');
  const active = await (await ask('How many active users are there?')).json() as { answer: string };
  expect(active.answer).toContain('48 active accounts');
  expect(state.writes).toHaveLength(2);
  const unsupported = await (await ask('How many verified people in Boston?')).json() as { answer: string };
  expect(unsupported.answer).toContain('People directory filters');
});
