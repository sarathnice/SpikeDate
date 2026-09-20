export const vibePrompts = [
  {
    question: 'Our first date starts with…',
    ideas: [
      'Coffee and an easy conversation.',
      'A walk somewhere new.',
      'Dinner at a cozy little place.',
      'A little adventure together.',
    ],
  },
  {
    question: 'My weekend energy…',
    ideas: [
      'Outdoors and a little adventure.',
      'Cozy food and a good movie.',
      'Friends and live music.',
      'A little of everything.',
    ],
  },
  {
    question: 'Win me over with…',
    ideas: [
      'Kindness in the little things.',
      'A sense of humor.',
      'Curiosity and good questions.',
      'Thoughtfulness, not grand gestures.',
    ],
  },
  ...[
    'Ask me about…',
    'A small thing I love…',
    'Together we could…',
    'My happy place…',
    'A skill I’d love to learn…',
    'I’ll always make time for…',
    'A perfect little adventure…',
    'Something that makes me laugh…',
    'One thing I’m proud of…',
  ].map((question) => ({ question, ideas: [] as string[] })),
  {
    question: 'My Sunday vibe is…',
    ideas: [
      'Slow coffee and a good book.',
      'A hike and a great lunch.',
      'Friends, music, and no rush.',
      'Exploring somewhere new.',
    ],
  },
  {
    question: 'A trip I’d love to take…',
    ideas: [
      'A scenic road trip.',
      'A city full of food and art.',
      'A quiet beach escape.',
      'A little adventure in nature.',
    ],
  },
  { question: 'A song I’ll always play…', ideas: [] as string[] },
  { question: 'Something you wouldn’t guess about me…', ideas: [] as string[] },
  {
    question: 'A little thing that makes me feel cared for…',
    ideas: [
      'Remembering the little things I share.',
      'Making time for an unhurried conversation.',
      'A thoughtful check-in.',
      'Laughing together after a long day.',
    ],
  },
];

export const vibeSetupSteps = [0, 4, 7, 5, 8] as const;
