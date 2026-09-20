import type { ProfileConnection } from './profile-connection';
const women = [
  'Maya',
  'Lena',
  'Imani',
  'Ava',
  'Sofia',
  'Chloe',
  'Zoe',
  'Amara',
  'Nina',
  'Layla',
  'Camila',
  'Mei',
  'Fatima',
  'Grace',
  'Elena',
  'Tara',
  'Jade',
  'Rhea',
  'Mila',
  'Priya',
  'Isabel',
  'Ruby',
  'Naomi',
  'Leah',
  'Nora',
  'Ella',
  'Mia',
  'Sara',
  'Alice',
  'Rose',
];
const men = [
  'Noah',
  'Mateo',
  'Elias',
  'Daniel',
  'Arjun',
  'Marcus',
  'Theo',
  'Liam',
  'Omar',
  'Kenji',
  'Andre',
  'Samuel',
  'Rafael',
  'Ethan',
  'Dev',
  'Isaac',
  'Gabriel',
  'Mason',
  'Alex',
  'Oliver',
  'James',
  'Lucas',
  'Leo',
  'Adam',
  'Ben',
  'Max',
  'Henry',
  'Ryan',
  'David',
  'Hugo',
];
export const syntheticProfiles = Array.from({ length: 60 }, (_, offset) => {
  const woman = offset % 2 === 0;
  const index = Math.floor(offset / 2);
  const suffix = String(offset + 1).padStart(3, '0');
  const connection: ProfileConnection = {
    relationshipStyle: index % 5 ? 'Monogamy' : 'Figuring it out',
    datingPace: ['Chat first', 'Meet when comfortable', 'Take it slowly'][
      index % 3
    ] as ProfileConnection['datingPace'],
    communicationPreference: ['Texting', 'Calls', 'In-person conversation'][
      index % 3
    ] as ProfileConnection['communicationPreference'],
    values:
      index % 2
        ? ['Honesty', 'Family', 'Kindness']
        : ['Kindness', 'Curiosity', 'Independence'],
    rhythm: [
      index % 2 ? 'Early bird' : 'Night owl',
      index % 3 ? 'Quiet weekends' : 'Social weekends',
    ],
    languages: index % 3 ? ['English'] : ['English', 'Spanish'],
  };
  return {
    id: `test-${suffix}`,
    email: `test${suffix}@spikedate.test`,
    name: woman ? women[index] : men[index],
    gender: woman ? 'woman' : 'man',
    asset: (woman
      ? ['maya', 'lena', 'imani', 'ava']
      : ['noah', 'mateo', 'jordan', 'elias'])[index % 4],
    connection,
  };
});
