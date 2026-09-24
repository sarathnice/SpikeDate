import { z } from 'zod';
import { coarseCoordinateE6 } from '@/lib/discovery-location';
import { registrationAreaFromCensus } from '@/lib/registration-location';
import { json, readJson } from '@/lib/server/http';

export const runtime = 'edge';

const schema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: 'Invalid origin.' }, { status: 403 });
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Location is unavailable. Enter a city and state.' }, { status: 400 });

  {
    // City suggestions need only approximate coordinates; never persist a
    // registration lookup or send device-precision coordinates to the provider.
    const latitude = coarseCoordinateE6(parsed.data.latitude) / 1_000_000;
    const longitude = coarseCoordinateE6(parsed.data.longitude) / 1_000_000;
    const parameters = new URLSearchParams({
      x: String(longitude),
      y: String(latitude),
      benchmark: 'Public_AR_Current',
      vintage: 'Current_Current',
      format: 'json',
    });
    try {
      const response = await fetch(
        `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?${parameters}`,
        { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } },
      );
      if (!response.ok) throw new Error('Location lookup unavailable.');
      const area = registrationAreaFromCensus(await response.json());
      if (!area)
        return json(
          { error: 'We could not identify a U.S. city here. Enter your city and state.' },
          { status: 422 },
        );
      return json({ area });
    } catch {
      return json(
        { error: 'Location lookup is unavailable. Enter your city and state.' },
        { status: 503 },
      );
    }
  }
}
