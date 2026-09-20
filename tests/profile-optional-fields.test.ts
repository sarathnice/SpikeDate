import { it, expect, vi } from 'vitest';
const batch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({ id: 'new-user' }),
}));
vi.mock('@/lib/server/profile-readiness', () => ({
  reconcileDiscoverability: async () => ({ ready: false }),
}));
vi.mock('@/lib/server/db', () => ({
  withDatabase: (run: () => unknown) => run(),
  getDb: () => ({
    batch,
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [] }),
        first: async () => null,
      }),
    }),
  }),
}));
import { PATCH } from '@/app/api/profile/route';
it.each(['prompts', 'interests'])(
  'saving empty optional %s does not send an invalid empty D1 batch',
  async (section) => {
    batch.mockClear();
    const response = await PATCH(
      new Request('http://local/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section, data: [] }),
      }),
    );
    expect(response.status).toBe(200);
    expect(batch).not.toHaveBeenCalled();
  },
);
