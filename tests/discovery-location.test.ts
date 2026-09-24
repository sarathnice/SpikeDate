import { describe, expect, it } from 'vitest';
import {
  coarseCoordinateE6,
  distanceKm,
  matchesDiscoveryLocation,
  type ViewerLocation,
} from '../lib/discovery-location';

const boston: ViewerLocation = {
  mode: 'device',
  latitudeE6: 42_360_000,
  longitudeE6: -71_060_000,
  city: null,
  updatedAt: Date.now(),
};

describe('discovery location', () => {
  it('rounds raw device coordinates before storage', () => {
    expect(coarseCoordinateE6(42.357891)).toBe(42_360_000);
    expect(coarseCoordinateE6(-71.063912)).toBe(-71_060_000);
  });

  it('finds nearby coordinates but excludes a different city', () => {
    expect(
      matchesDiscoveryLocation(
        boston,
        {
          latitudeE6: 42_370_000,
          longitudeE6: -71_110_000,
          city: 'Cambridge',
          discoveryCity: null,
        },
        10,
      ),
    ).toBe(true);
    expect(
      matchesDiscoveryLocation(
        boston,
        {
          latitudeE6: 41_880_000,
          longitudeE6: -87_630_000,
          city: 'Chicago',
          discoveryCity: null,
        },
        50,
      ),
    ).toBe(false);
    expect(distanceKm(42.36, -71.06, 42.37, -71.11)).toBeLessThan(10);
  });

  it('matches a manually chosen city without device coordinates', () => {
    expect(
      matchesDiscoveryLocation(
        { ...boston, mode: 'city', city: '  bOsToN  ' },
        {
          latitudeE6: null,
          longitudeE6: null,
          city: 'Boston',
          discoveryCity: null,
        },
        50,
      ),
    ).toBe(true);
    expect(
      matchesDiscoveryLocation(
        { ...boston, mode: 'city', city: 'Boston' },
        {
          latitudeE6: null,
          longitudeE6: null,
          city: 'Boston',
          discoveryCity: 'Chicago',
        },
        50,
      ),
    ).toBe(false);
  });

  it('does not present unlocated people as nearby', () => {
    expect(
      matchesDiscoveryLocation(
        boston,
        {
          latitudeE6: null,
          longitudeE6: null,
          city: 'Boston',
          discoveryCity: null,
        },
        50,
      ),
    ).toBe(false);
  });
});
