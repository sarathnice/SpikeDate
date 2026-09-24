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
  'Yara', 'Ayla', 'Kira', 'Anika', 'Tessa',
  'Celeste', 'Nadia', 'Iris', 'June', 'Alina',
  'Saanvi', 'Emily', 'Beatriz', 'Hana', 'Aisha',
  'Quinn', 'Stella', 'Lucia', 'Nia', 'Harper',
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
  'Karim', 'Julien', 'Aaron', 'Miles', 'Amir',
  'Victor', 'Nathan', 'Ezra', 'Jae', 'Soren',
  'Caleb', 'Ravi', 'Simon', 'Diego', 'Peter',
  'Yusuf', 'Jonah', 'Rohan', 'Felix', 'Keon',
];
export const syntheticProfiles = Array.from({ length: 100 }, (_, offset) => {
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
    city: offset % 2 === 0 ? 'Boston' : 'Cambridge',
    region: 'MA',
    asset: (woman
      ? ['maya', 'lena', 'imani', 'ava']
      : ['noah', 'mateo', 'jordan', 'elias'])[index % 4],
    connection,
  };
});
