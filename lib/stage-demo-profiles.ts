import { syntheticProfiles } from './synthetic-profiles.ts';

// These identities are fictional QA fixtures. They must only be shown in a
// clearly identified demo environment, never as real members.
const places = [
  ['Boston', 'MA', 42.3601, -71.0589],
  ['New York', 'NY', 40.7128, -74.006],
  ['Chicago', 'IL', 41.8781, -87.6298],
  ['Los Angeles', 'CA', 34.0522, -118.2437],
  ['San Francisco', 'CA', 37.7749, -122.4194],
  ['Seattle', 'WA', 47.6062, -122.3321],
  ['Austin', 'TX', 30.2672, -97.7431],
  ['Atlanta', 'GA', 33.749, -84.388],
  ['Miami', 'FL', 25.7617, -80.1918],
  ['Denver', 'CO', 39.7392, -104.9903],
  ['Washington', 'DC', 38.9072, -77.0369],
  ['Philadelphia', 'PA', 39.9526, -75.1636],
  ['Dallas', 'TX', 32.7767, -96.797],
  ['Houston', 'TX', 29.7604, -95.3698],
  ['Portland', 'OR', 45.5152, -122.6784],
  ['San Diego', 'CA', 32.7157, -117.1611],
  ['Minneapolis', 'MN', 44.9778, -93.265],
  ['Nashville', 'TN', 36.1627, -86.7816],
  ['New Orleans', 'LA', 29.9511, -90.0715],
  ['Charlotte', 'NC', 35.2271, -80.8431],
] as const;

const activities = [
  'finding a new coffee place',
  'live music after work',
  'weekend hikes',
  'cooking for friends',
  'wandering through bookstores',
  'trying a new restaurant',
  'a long walk by the water',
  'an unplanned museum visit',
  'farmers markets on Sunday',
  'a good game night',
] as const;

const conversationStarters = [
  'Tell me about a place you would visit again.',
  'What song always improves your day?',
  'What is your ideal slow Sunday?',
  'Which meal would you happily make twice?',
  'What little thing made you laugh this week?',
] as const;

export const stageDemoProfiles = syntheticProfiles.slice(0, 50).map((fixture, index) => {
  const [city, region, latitude, longitude] = places[(index * 7) % places.length];
  const activity = activities[index % activities.length];
  const starter = conversationStarters[Math.floor(index / activities.length) % conversationStarters.length];
  const birthYear = 2003 - (index % 25);
  return {
    id: fixture.id,
    email: fixture.email,
    name: fixture.name,
    gender: fixture.gender,
    birthDate: `${birthYear}-${String((index % 12) + 1).padStart(2, '0')}-15`,
    city,
    region,
    country: 'US',
    latitudeE6: Math.round(latitude * 1_000_000),
    longitudeE6: Math.round(longitude * 1_000_000),
    bio: `I am usually ${activity}. ${starter}`,
    relationshipGoal: ['Long-term', 'Marriage', 'Dating', 'Short-term'][index % 4],
    photoPaths: Array.from({ length: 6 }, (_, photoIndex) =>
      `assets/stage-demo/${fixture.id}-${photoIndex + 1}.png`,
    ),
  };
});
