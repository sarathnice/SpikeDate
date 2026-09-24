export type DiscoveryLocationMode = 'unset' | 'device' | 'city' | 'denied';

export type DiscoveryLocation = {
  mode: DiscoveryLocationMode;
  city: string | null;
  updatedAt: number | null;
};

export type CandidateLocation = {
  latitudeE6: number | null;
  longitudeE6: number | null;
  city: string | null;
  discoveryCity: string | null;
};

export type ViewerLocation = DiscoveryLocation & {
  latitudeE6: number | null;
  longitudeE6: number | null;
};

export function normalizeCity(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function coarseCoordinateE6(value: number): number {
  // The server keeps roughly 1 km cells, never the device's raw GPS fix.
  return Math.round(value * 100) * 10_000;
}

export function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (latitudeB - latitudeA) * radians;
  const longitudeDelta = (longitudeB - longitudeA) * radians;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA * radians) *
      Math.cos(latitudeB * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchesDiscoveryLocation(
  viewer: ViewerLocation,
  candidate: CandidateLocation,
  maxDistanceKm: number,
): boolean {
  if (viewer.mode === 'city' && viewer.city) {
    const requested = normalizeCity(viewer.city);
    return normalizeCity(candidate.discoveryCity ?? candidate.city ?? '') === requested;
  }
  if (
    viewer.mode !== 'device' ||
    viewer.latitudeE6 === null ||
    viewer.longitudeE6 === null ||
    candidate.latitudeE6 === null ||
    candidate.longitudeE6 === null
  )
    return false;
  return (
    distanceKm(
      viewer.latitudeE6 / 1_000_000,
      viewer.longitudeE6 / 1_000_000,
      candidate.latitudeE6 / 1_000_000,
      candidate.longitudeE6 / 1_000_000,
    ) <= maxDistanceKm
  );
}
