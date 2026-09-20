import { expect, it } from 'vitest';
import { galaxyRoomNames, matchesGalaxyRoom } from '@/lib/galaxy-rooms';

it('has a real eligibility rule for every Galaxy space', () => {
  const examples = [
    {
      room: 'Tonight',
      profile: {
        availability: {
          startAt: '2026-09-20T21:00:00Z',
          endAt: '2026-09-21T00:00:00Z',
        },
      },
    },
    { room: 'Music', profile: { tags: ['Live music'] } },
    { room: 'Outdoors', profile: { tags: ['Nature trips'] } },
    { room: 'Food lovers', profile: { tags: ['Cooking'] } },
    { room: 'New in town', profile: { tags: ['New in town'] } },
    { room: 'Coffee dates', profile: { tags: ['Coffee'] } },
    { room: 'Pet people', profile: { facts: { pets: 'Has a dog' } } },
    { room: 'Arts & culture', profile: { tags: ['Films'] } },
  ] as const;
  expect(examples.map(({ room }) => room)).toEqual(galaxyRoomNames);
  for (const { room, profile } of examples)
    expect(
      matchesGalaxyRoom(room, profile, Date.parse('2026-09-20T20:00:00Z')),
    ).toBe(true);
});

it('never treats a missing, expired, or distant window as Tonight', () => {
  const now = Date.parse('2026-09-20T20:00:00Z');
  expect(matchesGalaxyRoom('Tonight', {}, now)).toBe(false);
  expect(
    matchesGalaxyRoom(
      'Tonight',
      {
        availability: {
          startAt: '2026-09-20T17:00:00Z',
          endAt: '2026-09-20T19:00:00Z',
        },
      },
      now,
    ),
  ).toBe(false);
  expect(
    matchesGalaxyRoom(
      'Tonight',
      {
        availability: {
          startAt: '2026-09-21T12:00:00Z',
          endAt: '2026-09-21T14:00:00Z',
        },
      },
      now,
    ),
  ).toBe(false);
});

it('does not place unrelated profiles into a space', () => {
  for (const room of galaxyRoomNames)
    expect(
      matchesGalaxyRoom(room, { tags: ['Chess'], facts: { pets: 'No pets' } }),
    ).toBe(false);
});
