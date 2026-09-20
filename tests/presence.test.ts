import { expect, it } from 'vitest';
import {
  isOnline,
  isRecentlyActive,
  RECENT_ACTIVITY_MS,
  ONLINE_TTL_MS,
} from '@/lib/presence';

const now = 1_000_000_000;
it('uses one recent-activity window, with an exclusive expiry boundary', () => {
  expect(isRecentlyActive(now, now)).toBe(true);
  expect(isRecentlyActive(now - RECENT_ACTIVITY_MS + 1, now)).toBe(true);
  expect(isRecentlyActive(now - RECENT_ACTIVITY_MS, now)).toBe(false);
  expect(isRecentlyActive(now - RECENT_ACTIVITY_MS - 1, now)).toBe(false);
});

it('does not invent activity for missing, invalid or future timestamps', () => {
  for (const timestamp of [null, undefined, 0, NaN, Infinity, now + 1]) {
    expect(isRecentlyActive(timestamp, now)).toBe(false);
  }
});

it('expires the live lease at its boundary', () => {
  expect(isOnline(now + ONLINE_TTL_MS, now)).toBe(true);
  expect(isOnline(now + 1, now)).toBe(true);
  expect(isOnline(now, now)).toBe(false);
  expect(isOnline(now - 1, now)).toBe(false);
});

it('does not interpret missing or invalid leases as online', () => {
  for (const timestamp of [
    null,
    undefined,
    NaN,
    Infinity,
    now + ONLINE_TTL_MS + 1,
  ]) {
    expect(isOnline(timestamp, now)).toBe(false);
  }
});
