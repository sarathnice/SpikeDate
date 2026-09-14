import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type PlaceFeature = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
    coordinates?: { longitude?: number; latitude?: number };
    context?: { neighborhood?: { name?: string }; place?: { name?: string } };
    poi_category?: string[];
    metadata?: { phone?: string };
  };
};

const categoryByActivity: Record<string, string> = {
  Coffee: 'coffee',
  Dinner: 'restaurant',
  Music: 'music_venue',
  Walk: 'park',
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = (env as unknown as { MAPBOX_ACCESS_TOKEN?: string })
    .MAPBOX_ACCESS_TOKEN;
  if (!token) return Response.json({ configured: false, venues: [] });

  const activity = url.searchParams.get('activity') || 'Coffee';
  const query = url.searchParams.get('q')?.trim();
  const proximity = url.searchParams.get('proximity');
  const neighborhood = url.searchParams.get('neighborhood')?.trim();
  const parameters = new URLSearchParams({
    access_token: token,
    limit: '8',
    language: 'en',
  });
  if (proximity) parameters.set('proximity', proximity);
  else parameters.set('proximity', 'ip');

  const endpoint = query
    ? `https://api.mapbox.com/search/searchbox/v1/forward?${new URLSearchParams(
        {
          ...Object.fromEntries(parameters),
          q: [query, neighborhood].filter(Boolean).join(', '),
          types: 'poi',
        },
      )}`
    : `https://api.mapbox.com/search/searchbox/v1/category/${categoryByActivity[activity] ?? 'coffee'}?${parameters}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/geo+json, application/json' },
    });
    if (!response.ok) throw new Error(`Mapbox returned ${response.status}`);
    const result = (await response.json()) as { features?: PlaceFeature[] };
    const venues = (result.features ?? []).flatMap((feature, index) => {
      const properties = feature.properties;
      const longitude =
        properties?.coordinates?.longitude ??
        feature.geometry?.coordinates?.[0];
      const latitude =
        properties?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];
      if (!properties?.name || latitude == null || longitude == null) return [];
      return [
        {
          id: properties.mapbox_id ?? feature.id ?? `mapbox-${index}`,
          name: properties.name,
          address:
            properties.full_address ??
            [properties.address, properties.place_formatted]
              .filter(Boolean)
              .join(', '),
          neighborhood:
            properties.context?.neighborhood?.name ??
            properties.context?.place?.name ??
            neighborhood ??
            'Nearby',
          distance: 'Nearby',
          price: '$$',
          category: properties.poi_category?.[0] ?? activity,
          latitude,
          longitude,
          provider: 'mapbox',
        },
      ];
    });
    return Response.json({ configured: true, venues });
  } catch (error) {
    console.error('Venue search failed', error);
    return Response.json(
      {
        configured: true,
        venues: [],
        error: 'Venue search is temporarily unavailable.',
      },
      { status: 503 },
    );
  }
}
