import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorized: true,
  roles: ['super_admin'] as string[],
  prior: false,
  report: true,
  writes: [] as string[],
}));
vi.mock('@/lib/server/admin', () => ({
  requireAdmin: async () => state.authorized
    ? { user: { id: 'staff-001' }, roles: state.roles }
    : new Response(null, { status: 403 }),
}));
vi.mock('@/lib/server/db', () => ({
  getDb: () => ({
    prepare(sql: string) {
      const statement = {
        sql,
        bind() { return statement; },
        async first() {
          if (sql.includes('FROM entitlement_ledger WHERE idempotency_key')) return state.prior ? { user_id: 'member-001' } : null;
          if (sql.includes('FROM users WHERE id')) return { id: 'member-001' };
          if (sql.includes('FROM safety_actions WHERE id')) return state.report ? { id: 'report-001', reporter_id: 'member-001', subject_id: 'member-002', created_at: Date.now() } : null;
          if (sql.includes('FROM entitlement_wallets')) return { super_spikes: 1, profile_lifts: 0 };
          return null;
        },
        async all() { return { results: [], success: true }; },
        async run() { state.writes.push(sql); return { success: true }; },
      };
      return statement;
    },
    batch: async (statements: Array<{ sql: string }>) => { state.writes.push(...statements.map((item) => item.sql)); },
  }),
  withDatabase: async (run: () => Promise<unknown>) => run(),
}));
vi.mock('@/lib/server/http', () => ({
  readJson: async (request: Request) => request.json(),
  json: (body: unknown, options?: { status?: number }) => Response.json(body, { status: options?.status ?? 200 }),
  identifier: () => 'audit-1',
}));
import { POST as grantCredit } from '@/app/api/admin/users/[id]/credits/route';
import { POST as viewMessages } from '@/app/api/admin/cases/[id]/messages/route';

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (url: string, body: object) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { state.authorized = true; state.roles = ['super_admin']; state.prior = false; state.report = true; state.writes = []; });

it('allows only an authorized, reasoned and idempotent credit grant', async () => {
  const payload = { kind: 'super_spike', amount: 1, reason: 'Replacement for failed delivery', requestId: '11111111-1111-4111-8111-111111111111' };
  state.authorized = false;
  expect((await grantCredit(post('http://local/credits', payload), context('member-001'))).status).toBe(403);
  expect(state.writes).toHaveLength(0);
  state.authorized = true;
  expect((await grantCredit(post('http://local/credits', { ...payload, reason: 'short' }), context('member-001'))).status).toBe(400);
  expect((await grantCredit(post('http://local/credits', payload), context('member-001'))).status).toBe(200);
  expect(state.writes.some((sql) => sql.includes('INSERT INTO entitlement_ledger'))).toBe(true);
  expect(state.writes.some((sql) => sql.includes('INSERT INTO audit_logs'))).toBe(true);
  state.writes = []; state.prior = true;
  expect((await grantCredit(post('http://local/credits', payload), context('member-001'))).status).toBe(200);
  expect(state.writes).toHaveLength(0);
});

it('never opens message evidence without a report, admin authorization and recorded reason', async () => {
  const body = { reason: 'Investigating report from member' };
  state.authorized = false;
  expect((await viewMessages(post('http://local/messages', body), context('report-001'))).status).toBe(403);
  state.authorized = true;
  expect((await viewMessages(post('http://local/messages', { reason: 'short' }), context('report-001'))).status).toBe(400);
  state.report = false;
  expect((await viewMessages(post('http://local/messages', body), context('missing'))).status).toBe(404);
  state.report = true;
  expect((await viewMessages(post('http://local/messages', body), context('report-001'))).status).toBe(200);
  expect(state.writes.some((sql) => sql.includes('INSERT INTO audit_logs'))).toBe(true);
});
