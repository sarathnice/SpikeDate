import { describe, expect, it } from 'vitest';
import { registrationAreaFromCensus } from '../lib/registration-location';

describe('registration location suggestion', () => {
  it('extracts a U.S. city and state from a Census coordinate lookup', () => {
    expect(
      registrationAreaFromCensus({
        result: {
          geographies: {
            States: [{ NAME: 'Massachusetts', STUSAB: 'MA' }],
            'Incorporated Places': [{ NAME: 'Boston city' }],
          },
        },
      }),
    ).toEqual({ city: 'Boston', region: 'MA', country: 'US' });
  });

  it('uses a subdivision when an incorporated city is unavailable', () => {
    expect(
      registrationAreaFromCensus({
        result: {
          geographies: {
            States: [{ STUSAB: 'MA' }],
            'County Subdivisions': [{ NAME: 'Brookline town' }],
          },
        },
      }),
    ).toEqual({ city: 'Brookline', region: 'MA', country: 'US' });
  });

  it('leaves manual entry open when no city or state can be resolved', () => {
    expect(registrationAreaFromCensus({ result: { geographies: {} } })).toBeNull();
  });
});
