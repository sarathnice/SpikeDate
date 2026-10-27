import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ role: 'super_admin', row: null as null | { label: string; version: number; updated_at: number }, conflict: false, writes: [] as Array<{ sql: string; values: unknown[] }>, env: { SPIKEDATE_LOCAL_PROFILE_DEMO: 'true', SPIKEDATE_FICTIONAL_PROFILES: 'false' } }));
vi.mock('cloudflare:workers', () => ({ env: state.env }));
vi.mock('@/lib/server/admin', () => ({ requireAdmin: async (_request: Request, _db: unknown, roles: string[]) => roles.includes(state.role) ? { user: { id: 'qa-admin' }, roles: [state.role] } : new Response(null, { status: 403 }) }));
vi.mock('@/lib/server/db', () => {
  const db = {
    prepare(sql: string) {
      const statement = { sql, values: [] as unknown[], bind(...values: unknown[]) { statement.values = values; return statement; }, async first() { return sql.includes('COUNT(*)') ? { count: 500 } : state.row; } };
      return statement;
    },
    async batch(statements: Array<{ sql: string; values: unknown[] }>) { state.writes = statements; return [{ success: true, meta: { changes: state.conflict ? 0 : 1 } }, { success: true, meta: { changes: state.conflict ? 0 : 1 } }]; },
  };
  return { withDatabase: async (fn: (db: unknown) => Promise<unknown>) => fn(db) };
});
import { GET, PATCH } from '@/app/api/admin/environment/banner/route';
import { bannerEnvironment, bannerText, readBanner } from '@/lib/environment-banner';
const request = (body: object, origin = 'http://localhost') => new Request('http://localhost/api/admin/environment/banner', { method: 'PATCH', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
const payload = { label: 'Staging', expectedVersion: 0, reason: 'Clarify the current testing environment.' };
beforeEach(() => { state.role = 'super_admin'; state.row = null; state.conflict = false; state.writes = []; state.env.SPIKEDATE_LOCAL_PROFILE_DEMO = 'true'; state.env.SPIKEDATE_FICTIONAL_PROFILES = 'false'; });

it('scopes the control to explicitly marked fictional environments', async () => {
  expect(bannerEnvironment({})).toBeNull();
  expect(bannerEnvironment({ SPIKEDATE_FICTIONAL_PROFILES: 'true' })).toBe('staging');
  state.env.SPIKEDATE_LOCAL_PROFILE_DEMO = 'false';
  expect((await PATCH(request(payload))).status).toBe(409);
  expect(state.writes).toHaveLength(0);
});
it.each(['support_agent', 'moderator', 'read_only_analyst', 'member'])('rejects %s reads and writes', async role => {
  state.role = role;
  expect((await GET(new Request('http://localhost/api/admin/environment/banner'))).status).toBe(403);
  expect((await PATCH(request(payload))).status).toBe(403);
  expect(state.writes).toHaveLength(0);
});
it('returns the actual affected profile count and non-cacheable defaults', async () => {
  const response = await GET(new Request('http://localhost/api/admin/environment/banner'));
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ label: 'Local demo', text: 'Local demo · fictional profiles', affectedProfiles: 500, version: 0 });
});
it.each([{ label: '<script>fake</script>' }, { label: '' }, { reason: 'short' }, { enabled: false }, { expectedVersion: -1 }])('rejects invalid or disclosure-hiding payload %j', async overrides => {
  expect((await PATCH(request({ ...payload, ...overrides }))).status).toBe(400);
  expect(state.writes).toHaveLength(0);
});
it('rejects a cross-origin save', async () => {
  expect((await PATCH(request(payload, 'https://other.example'))).status).toBe(403);
  expect(state.writes).toHaveLength(0);
});
it('saves one global row with an atomic conditional audit, never editing profiles', async () => {
  const response = await PATCH(request(payload));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ text: 'Staging · fictional profiles', affectedProfiles: 500, version: 1 });
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0].sql).toContain('WHERE environment_banners.version = ?');
  expect(state.writes[1].sql).toContain('WHERE environment=? AND change_id=?');
  expect(state.writes.some(row => /UPDATE profiles|DELETE|UPDATE users/.test(row.sql))).toBe(false);
  expect(state.writes[1].values).toContain('admin.environment.banner.update');
});
it('rejects stale versions and concurrent changes', async () => {
  state.row = { label: 'Local demo', version: 2, updated_at: 1 };
  expect((await PATCH(request(payload))).status).toBe(409);
  expect(state.writes).toHaveLength(0);
  state.row = null; state.conflict = true;
  expect((await PATCH(request(payload))).status).toBe(409);
});
it('does not create duplicate audits for an unchanged label', async () => {
  state.row = { label: 'Staging', version: 1, updated_at: 1 };
  expect((await PATCH(request({ ...payload, expectedVersion: 1 }))).status).toBe(200);
  expect(state.writes).toHaveLength(0);
});
it('falls back to a safe label if stored text is unrecognized', async () => {
  const db = { prepare: () => ({ bind: () => ({ first: async () => ({ label: '<script>', version: 1, updated_at: 1 }) }) }) };
  const setting = await readBanner(db as never, 'staging');
  expect(bannerText(setting.label)).toBe('Test environment · fictional profiles');
});
