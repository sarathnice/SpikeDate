import { it, expect } from 'vitest';
import {
  connectionSchema,
  connectionFromRow,
  emptyConnection,
} from '@/lib/profile-connection';
import { syntheticProfiles } from '@/lib/synthetic-profiles';
it('allows a completely skipped connection section', () =>
  expect(connectionSchema.parse({})).toEqual(emptyConnection));
it('keeps personal values separate and limits them to three unique choices', () => {
  expect(
    connectionSchema.safeParse({ values: ['Kindness', 'Honesty', 'Family'] })
      .success,
  ).toBe(true);
  expect(
    connectionSchema.safeParse({
      values: ['Kindness', 'Honesty', 'Family', 'Growth'],
    }).success,
  ).toBe(false);
  expect(
    connectionSchema.safeParse({ values: ['Kindness', 'Kindness'] }).success,
  ).toBe(false);
});
it('prevents contradictory everyday rhythm selections', () => {
  expect(
    connectionSchema.safeParse({ rhythm: ['Early bird', 'Night owl'] }).success,
  ).toBe(false);
  expect(
    connectionSchema.safeParse({
      rhythm: ['Quiet weekends', 'Social weekends'],
    }).success,
  ).toBe(false);
  expect(
    connectionSchema.safeParse({ rhythm: ['Early bird', 'Social weekends'] })
      .success,
  ).toBe(true);
});
it('normalizes languages and rejects duplicate, oversized and unsupported answers', () => {
  expect(
    connectionSchema.parse({ languages: [' English ', 'French'] }).languages,
  ).toEqual(['English', 'French']);
  expect(
    connectionSchema.safeParse({ languages: ['English', 'english'] }).success,
  ).toBe(false);
  expect(
    connectionSchema.safeParse({ datingPace: 'unsafe arbitrary option' })
      .success,
  ).toBe(false);
});
it('handles missing or malformed stored JSON without manufacturing details', () => {
  expect(connectionFromRow(null)).toEqual(emptyConnection);
  expect(connectionFromRow({ values_json: 'broken' })).toEqual(emptyConnection);
  expect(
    connectionFromRow({
      relationship_style: 'Monogamy',
      values_json: '["Kindness"]',
    }).values,
  ).toEqual(['Kindness']);
});
it('offers fifty valid synthetic profiles with balanced genders and unique accounts', () => {
  expect(syntheticProfiles).toHaveLength(50);
  expect(new Set(syntheticProfiles.map((x) => x.email)).size).toBe(50);
  expect(syntheticProfiles.filter((x) => x.gender === 'woman')).toHaveLength(
    25,
  );
  expect(syntheticProfiles.filter((x) => x.gender === 'man')).toHaveLength(25);
  for (const profile of syntheticProfiles)
    expect(connectionSchema.safeParse(profile.connection).success).toBe(true);
});
