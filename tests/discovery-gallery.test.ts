import { expect, it, vi } from 'vitest';
const queries = vi.hoisted(() => [] as string[]);
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({ id: 'viewer' }),
}));
vi.mock('@/lib/server/db', () => ({
  withDatabase: (run: () => unknown) => run(),
  getDb: () => ({
    prepare: (sql: string) => {
      queries.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async () => ({
            min_age: 21,
            max_age: 55,
            genders_json: '["Woman"]',
            relationship_goals_json: '["Dating"]',
          }),
          all: async () => ({
            results: sql.includes('SELECT id, user_id, type FROM profile_media')
              ? [
                  { id: 'photo-a', user_id: 'partner', type: 'photo' },
                  { id: 'photo-b', user_id: 'partner', type: 'photo' },
                  { id: 'video-a', user_id: 'partner', type: 'video' },
                ]
              : sql.includes('FROM profile_prompts')
                ? [
                    {
                      user_id: 'partner',
                      prompt: 'Our first date starts with…',
                      answer: 'A walk somewhere new.',
                    },
                  ]
                : [
                    {
                      user_id: 'partner',
                      display_name: 'Test Partner',
                      birth_date: '1995-01-01',
                      gender: 'woman',
                      relationship_goal: 'Dating',
                      verification_status: 'unverified',
                      primary_media_id: 'photo-a',
                    },
                  ],
          }),
        }),
      };
    },
  }),
}));
import { GET } from '@/app/api/discover/route';
it('returns ordered full-gallery media with an approved-only batched query', async () => {
  const response = await GET(new Request('http://local/api/discover'));
  const data = (await response.json()) as {
    profiles: Array<{
      zodiac: string;
      media: Array<{ type: string; url: string }>;
      prompts: Array<{ prompt: string; answer: string }>;
    }>;
  };
  expect(data.profiles).toHaveLength(1);
  expect(data.profiles[0].media).toEqual([
    { type: 'photo', url: '/api/media/photo-a' },
    { type: 'photo', url: '/api/media/photo-b' },
    { type: 'video', url: '/api/media/video-a' },
  ]);
  expect(
    queries.find((sql) => sql.startsWith('SELECT id, user_id, type')),
  ).toContain("moderation_status = 'approved'");
  expect(data.profiles[0].zodiac).toBe('Capricorn');
  expect(data.profiles[0].prompts).toEqual([
    { prompt: 'Our first date starts with…', answer: 'A walk somewhere new.' },
  ]);
  expect(data.profiles[0]).not.toHaveProperty('birth_date');
  expect(data.profiles[0]).not.toHaveProperty('birthDate');
  expect(
    queries.find((sql) => sql.startsWith('SELECT id, user_id, type')),
  ).toContain('ORDER BY position, id');
  const candidateQuery = queries.find((sql) =>
    sql.startsWith('SELECT profiles.user_id'),
  );
  expect(candidateQuery).toContain("updates.visibility = 'discover'");
  expect(candidateQuery).toContain("availability_match.status = 'active'");
});

it('can include existing matches in a Galaxy-specific discovery refresh', async () => {
  queries.length = 0;
  await GET(new Request('http://local/api/discover?includeMatches=1'));
  expect(
    queries.find((sql) => sql.startsWith('SELECT profiles.user_id')),
  ).toContain("room_match.status = 'active'");
});
