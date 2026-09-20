import { describe, it, expect } from 'vitest';
import {
  zodiacFromBirthDate,
  pairingNotes,
  zodiacSigns,
} from '../lib/astrology';
describe('fixed Western zodiac date ranges', () => {
  const boundaries = [
    '03-21',
    '04-20',
    '05-21',
    '06-21',
    '07-23',
    '08-23',
    '09-23',
    '10-23',
    '11-22',
    '12-22',
    '01-20',
    '02-19',
  ];
  boundaries.forEach((day, index) =>
    it(`starts ${zodiacSigns[index]} at ${day}`, () => {
      expect(zodiacFromBirthDate(`2000-${day}`)).toBe(zodiacSigns[index]);
      const previous = new Date(`2000-${day}T00:00:00Z`);
      previous.setUTCDate(previous.getUTCDate() - 1);
      expect(zodiacFromBirthDate(previous.toISOString().slice(0, 10))).toBe(
        zodiacSigns[(index + 11) % 12],
      );
    }),
  );
  it('handles year wrap and leap day', () => {
    expect(zodiacFromBirthDate('2000-12-31')).toBe('Capricorn');
    expect(zodiacFromBirthDate('2000-01-01')).toBe('Capricorn');
    expect(zodiacFromBirthDate('2000-02-29')).toBe('Pisces');
  });
  it('rejects missing and invalid dates instead of inventing a sign', () => {
    for (const value of [
      null,
      undefined,
      '',
      '2001-02-29',
      '2000-04-31',
      '07/23/2000',
    ])
      expect(zodiacFromBirthDate(value)).toBeNull();
  });
  it('keeps the directional first chart separate from symmetric second-chart themes', () => {
    expect(pairingNotes('Scorpio', 'Taurus').chartOne).toBe(
      'Suggested pairing',
    );
    expect(pairingNotes('Taurus', 'Scorpio').chartOne).toBe(
      'Different rhythms',
    );
    expect(pairingNotes('Scorpio', 'Taurus').chartTwo).toEqual(
      pairingNotes('Taurus', 'Scorpio').chartTwo,
    );
    expect(pairingNotes('Leo', 'Aries').chartOne).toBe('Suggested pairing');
    expect(pairingNotes('Leo', 'Gemini').chartOne).toBe('Not listed');
  });
});
