import { expect, it } from 'vitest';
import { tonightWindow } from '@/lib/today-availability';

for (const hour of [0, 4, 5, 6, 9, 12, 18, 23]) {
  it(`Tonight published at ${hour}:00 stays within the server limit`, () => {
    const now = new Date(2026, 8, 16, hour);
    const window = tonightWindow(now);
    const start = Date.parse(window.startAt);
    const end = Date.parse(window.endAt);
    expect(start).toBeGreaterThanOrEqual(now.getTime());
    expect(end).toBeGreaterThan(start);
    expect(end - start).toBeLessThanOrEqual(18 * 60 * 60 * 1000);
    expect(new Date(end).getHours()).toBe(5);
  });
}
