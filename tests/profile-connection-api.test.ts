import { it, expect, vi, beforeEach } from 'vitest';
const qa = vi.hoisted(() => ({
  visible: true,
  authenticated: true,
  sql: [] as string[],
  connectionReads: 0,
}));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () =>
    qa.authenticated ? { id: 'viewer' } : new Response(null, { status: 401 }),
}));
vi.mock('@/lib/server/db', () => ({
  withDatabase: (run: (db: unknown) => unknown) =>
    run({
      prepare: (sql: string) => {
        qa.sql.push(sql);
        return {
          bind: () => ({
            all: async () => ({ results: [] }),
            first: async () => {
              if (sql.includes('FROM profile_connections')) {
                qa.connectionReads++;
                return {
                  relationship_style: 'Monogamy',
                  values_json: '["Kindness"]',
                };
              }
              return qa.visible ? { user_id: 'target' } : null;
            },
          }),
        };
      },
    }),
}));
import { GET } from '@/app/api/profiles/[id]/connection/route';
beforeEach(() => {
  qa.visible = true;
  qa.authenticated = true;
  qa.sql = [];
  qa.connectionReads = 0;
});
const get = () =>
  GET(new Request('http://local/api/profiles/target/connection'), {
    params: Promise.resolve({ id: 'target' }),
  });
it('requires authentication before looking up profile details', async () => {
  qa.authenticated = false;
  expect((await get()).status).toBe(401);
  expect(qa.sql).toHaveLength(0);
});
it('does not expose unavailable or blocked profile connection data', async () => {
  qa.visible = false;
  expect((await get()).status).toBe(404);
  expect(qa.connectionReads).toBe(0);
});
it('returns only declared public details after visibility and mutual-block checks', async () => {
  const response = await get();
  expect(response.status).toBe(200);
  const data = (await response.json()) as { connection: { values: string[] } };
  expect(data.connection.values).toEqual(['Kindness']);
  expect(data).not.toHaveProperty('birthDate');
  expect(data).not.toHaveProperty('email');
  expect(qa.sql[0]).toContain("users.status = 'active'");
  expect(qa.sql[0]).toContain("kind = 'block'");
  expect(qa.sql[0]).toContain("status = 'active'");
});
