type CensusGeography = { NAME?: string; STUSAB?: string };
type CensusResponse = {
  result?: {
    geographies?: {
      States?: CensusGeography[];
      'Incorporated Places'?: CensusGeography[];
      'Census Designated Places'?: CensusGeography[];
      'County Subdivisions'?: CensusGeography[];
    };
  };
};

export type SuggestedRegistrationArea = {
  city: string;
  region: string;
  country: 'US';
};

export function registrationAreaFromCensus(
  response: CensusResponse,
): SuggestedRegistrationArea | null {
  const geography = response.result?.geographies;
  const region = geography?.States?.[0]?.STUSAB?.trim();
  const place =
    geography?.['Incorporated Places']?.[0]?.NAME ??
    geography?.['Census Designated Places']?.[0]?.NAME ??
    geography?.['County Subdivisions']?.[0]?.NAME;
  const city = place
    ?.replace(/\s+(?:city|town|village|borough|CDP)$/i, '')
    .trim();
  if (!city || !region) return null;
  return { city, region, country: 'US' };
}
