import { describe, it, expect } from 'vitest';
import {
  heightToCentimeters,
  isAdult,
  passwordSchema,
} from '@/lib/account-validation';

describe('shared signup validation', () => {
  it('preserves metric heights from the database and accepts typographic imperial notation', () => {
    expect(heightToCentimeters('165 cm')).toBe(165);
    expect(heightToCentimeters('5′4″')).toBe(163);
    expect(heightToCentimeters('5\'4"')).toBe(163);
    for (const height of ['', '5′14″', 'invalid', '350 cm'])
      expect(heightToCentimeters(height)).toBeNull();
  });
  it('accepts the eighteenth birthday but rejects someone one day younger', () => {
    const now = new Date('2026-09-17T00:00:00Z');
    expect(isAdult('2008-09-17', now)).toBe(true);
    expect(isAdult('2008-09-18', now)).toBe(false);
  });
  it('rejects missing, impossible and future birthdays', () => {
    for (const value of ['', '2000-02-30', '1990-13-01', '2990-01-01'])
      expect(isAdult(value)).toBe(false);
  });
  it('enforces the same 12–128 character rule in the browser and server', () => {
    expect(passwordSchema.safeParse('Abcdefghi12').success).toBe(false);
    expect(passwordSchema.safeParse('Abcdefghij12').success).toBe(true);
    expect(passwordSchema.safeParse(`Ab1${'c'.repeat(125)}`).success).toBe(
      true,
    );
    expect(passwordSchema.safeParse(`Ab1${'c'.repeat(126)}`).success).toBe(
      false,
    );
  });
  it('requires uppercase, lowercase and a number', () => {
    for (const value of ['abcdefghij12', 'ABCDEFGHIJ12', 'Abcdefghijkl'])
      expect(passwordSchema.safeParse(value).success).toBe(false);
  });
});
