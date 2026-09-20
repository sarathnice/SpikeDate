export const zodiacSigns = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;
export type ZodiacSign = (typeof zodiacSigns)[number];

// Fixed Western sun-sign ranges supplied by the product owner; not an ephemeris.
export function zodiacFromBirthDate(value?: string | null): ZodiacSign | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  const md = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const starts = [321, 420, 521, 621, 723, 823, 923, 1023, 1122, 1222];
  if (md >= 1222 || md <= 119) return 'Capricorn';
  if (md <= 218) return 'Aquarius';
  if (md <= 320) return 'Pisces';
  for (let i = starts.length - 2; i >= 0; i--)
    if (md >= starts[i]) return zodiacSigns[i];
  return null;
}

const chart: Record<ZodiacSign, [ZodiacSign[], ZodiacSign[]]> = {
  Leo: [
    ['Libra', 'Sagittarius', 'Aries'],
    ['Cancer', 'Capricorn'],
  ],
  Gemini: [
    ['Libra', 'Aquarius', 'Aries'],
    ['Virgo', 'Cancer', 'Capricorn'],
  ],
  Scorpio: [
    ['Cancer', 'Pisces', 'Taurus'],
    ['Leo', 'Libra'],
  ],
  Aries: [
    ['Leo', 'Sagittarius', 'Gemini'],
    ['Cancer', 'Capricorn', 'Aries'],
  ],
  Libra: [
    ['Gemini', 'Aquarius', 'Leo'],
    ['Cancer', 'Capricorn', 'Scorpio'],
  ],
  Pisces: [
    ['Scorpio', 'Cancer', 'Taurus'],
    ['Sagittarius', 'Aquarius'],
  ],
  Taurus: [
    ['Cancer', 'Virgo'],
    ['Aquarius', 'Leo', 'Scorpio'],
  ],
  Aquarius: [
    ['Gemini', 'Pisces', 'Libra'],
    ['Taurus', 'Cancer'],
  ],
  Sagittarius: [
    ['Leo', 'Aries'],
    ['Cancer', 'Virgo', 'Pisces'],
  ],
  Virgo: [
    ['Taurus', 'Virgo', 'Cancer'],
    ['Gemini', 'Aries'],
  ],
  Cancer: [
    ['Taurus', 'Scorpio', 'Pisces'],
    ['Aries', 'Libra'],
  ],
  Capricorn: [
    ['Virgo', 'Taurus'],
    ['Libra', 'Aries', 'Gemini'],
  ],
};
const themes: Record<string, [ZodiacSign, ZodiacSign][]> = {
  'Lively chemistry': [
    ['Scorpio', 'Leo'],
    ['Sagittarius', 'Gemini'],
    ['Aries', 'Scorpio'],
    ['Taurus', 'Pisces'],
    ['Aquarius', 'Libra'],
    ['Capricorn', 'Cancer'],
    ['Gemini', 'Leo'],
    ['Virgo', 'Aries'],
  ],
  'A calming connection': [
    ['Cancer', 'Virgo'],
    ['Capricorn', 'Libra'],
    ['Aquarius', 'Gemini'],
    ['Taurus', 'Cancer'],
    ['Leo', 'Pisces'],
    ['Scorpio', 'Taurus'],
    ['Aries', 'Capricorn'],
    ['Sagittarius', 'Aquarius'],
    ['Aquarius', 'Cancer'],
  ],
  'An intriguing connection': [
    ['Pisces', 'Cancer'],
    ['Taurus', 'Virgo'],
    ['Gemini', 'Libra'],
    ['Aries', 'Sagittarius'],
    ['Scorpio', 'Capricorn'],
    ['Leo', 'Aquarius'],
    ['Virgo', 'Taurus'],
    ['Libra', 'Sagittarius'],
    ['Aquarius', 'Pisces'],
  ],
  'A supportive connection': [
    ['Leo', 'Libra'],
    ['Virgo', 'Cancer'],
    ['Aries', 'Gemini'],
    ['Pisces', 'Scorpio'],
    ['Gemini', 'Taurus'],
    ['Libra', 'Capricorn'],
    ['Cancer', 'Aries'],
    ['Sagittarius', 'Pisces'],
  ],
};
export function pairingNotes(viewer: ZodiacSign, other: ZodiacSign) {
  const [easy, challenging] = chart[viewer];
  return {
    chartOne: easy.includes(other)
      ? 'Suggested pairing'
      : challenging.includes(other)
        ? 'Different rhythms'
        : 'Not listed',
    chartTwo: Object.entries(themes)
      .filter(([, pairs]) =>
        pairs.some(
          ([a, b]) =>
            (a === viewer && b === other) || (b === viewer && a === other),
        ),
      )
      .map(([theme]) => theme),
  };
}
export const astrologyDisclaimer =
  'For entertainment and conversation only. Astrology is not a scientifically validated measure of compatibility and does not predict relationship outcomes or safety. These two supplied charts may disagree. Signs use approximate, fixed Western date ranges; cusp dates can vary by year. Your birth date is not shown here. Profiles are not ranked or excluded by astrology.';
