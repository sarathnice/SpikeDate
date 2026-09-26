import { beforeEach, expect, it, vi } from 'vitest';

const qa = vi.hoisted(() => ({
  authorized: true,
  targetStatus: 'active',
  targetIsAdmin: false,
  activeSuspension: false,
  writes: [] as string[],
}));
vi.mock('@/lib/server/admin', () => ({
  requireAdmin: async () => qa.authorized
    ? { user: { id: 'staff-001' }, roles: ['super_admin'] }
    : new Response(JSON.stringify({ error: 'Administrator access required.' }), { status: 403 }),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => ({
    prepare(sql: string) {
      const statement = {
        sql,
        bind() { return statement; },
        async first() {
          if (sql.startsWith('SELECT id, status FROM users')) return { id: 'member-001', status: qa.targetStatus };
          if (sql.includes('FROM admin_users')) return qa.targetIsAdmin ? { present: 1 } : null;
          if (sql.includes('FROM safety_actions')) return qa.activeSuspension ? { present: 1 } : null;
          return null;
        },
      };
      return statement;
    },
    batch: async (statements: Array<{ sql: string }>) => { qa.writes = statements.map((item) => item.sql); },
  }),
  withDatabase: async (run: () => Promise<unknown>) => run(),
}));
vi.mock('@/lib/server/http', () => ({
  readJson: async (request: Request) => request.json(),
  json: (body: unknown, options?: { status?: number }) => Response.json(body, { status: options?.status ?? 200 }),
  identifier: () => 'audit-1',
}));
import { PATCH } from '@/app/api/admin/users/[id]/route';

const patch = (id: string, action: string, note = 'Documented safety review.') => PATCH(
  new Request(`http://local/api/admin/users/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, note }),
  }), { params: Promise.resolve({ id }) },
);
beforeEach(() => { qa.authorized = true; qa.targetStatus = 'active'; qa.targetIsAdmin = false; qa.activeSuspension = false; qa.writes = []; });

it('blocks ordinary users from changing account status', async () => {
  qa.authorized = false;
  expect((await patch('member-001', 'suspend')).status).toBe(403);
  expect(qa.writes).toHaveLength(0);
});
it('protects own and other administrator accounts', async () => {
  expect((await patch('staff-001', 'suspend')).status).toBe(400);
  qa.targetIsAdmin = true;
  expect((await patch('member-001', 'suspend')).status).toBe(403);
  expect(qa.writes).toHaveLength(0);
});
it('requires a reason and audits a valid suspension', async () => {
  expect((await patch('member-001', 'suspend', 'short')).status).toBe(400);
  const response = await patch('member-001', 'suspend');
  expect(response.status).toBe(200);
  expect(qa.writes).toHaveLength(2);
  expect(qa.writes[0]).toContain('UPDATE users SET status');
  expect(qa.writes[1]).toContain('INSERT INTO audit_logs');
});
it('does not restore an account while a suspended report remains', async () => {
  qa.targetStatus = 'suspended'; qa.activeSuspension = true;
  expect((await patch('member-001', 'restore')).status).toBe(409);
  expect(qa.writes).toHaveLength(0);
});
