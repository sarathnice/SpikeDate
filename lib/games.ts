export type GameMood = 'Fun' | 'Flirty' | 'Get closer';
export type GameRound = { prompt: string; options?: string[]; guess?: boolean };
export type DatingGame = {
  id: string;
  name: string;
  mood: GameMood;
  description: string;
  rounds: GameRound[];
};
export const datingGames: DatingGame[] = [
  {
    id: 'this-or-that',
    name: 'This or That',
    mood: 'Fun',
    description: 'Small choices, surprising conversations.',
    rounds: [
      {
        prompt: 'Our imaginary first date starts with…',
        options: ['Coffee', 'Dessert'],
      },
      {
        prompt: 'A weekend escape would be…',
        options: ['By the sea', 'In the mountains'],
      },
      {
        prompt: 'A perfect evening ends with…',
        options: ['Live music', 'A movie'],
      },
    ],
  },
  {
    id: 'guess-my-pick',
    name: 'Guess My Pick',
    mood: 'Fun',
    description: 'Choose your favourite, then guess theirs.',
    rounds: [
      {
        prompt: 'A spontaneous afternoon?',
        options: ['Bookshop', 'Art gallery', 'Nature walk'],
        guess: true,
      },
      {
        prompt: 'My comfort-food choice?',
        options: ['Pizza', 'Noodles', 'Something homemade'],
        guess: true,
      },
      {
        prompt: 'My ideal travel pace?',
        options: ['Explore everything', 'Slow and relaxed', 'A little of both'],
        guess: true,
      },
    ],
  },
  {
    id: 'two-truths',
    name: 'Two Truths & a Twist',
    mood: 'Fun',
    description: 'Share two truths and one playful invention.',
    rounds: [
      {
        prompt:
          'Write two true things and one invented thing about a hobby. Number them 1–3; keep the secret until the reveal.',
      },
      {
        prompt:
          'Share three travel or food experiences: two real, one invented.',
      },
      {
        prompt:
          'Guess your partner’s invented statement from the last round, then reveal your own.',
      },
    ],
  },
  {
    id: 'emoji-story',
    name: 'Emoji Story',
    mood: 'Fun',
    description: 'Tell a tiny story without words.',
    rounds: [
      {
        prompt:
          'Describe a funny, harmless experience using up to five emojis.',
      },
      { prompt: 'Guess the story behind your partner’s emojis.' },
      { prompt: 'Tell the real story in a sentence.' },
    ],
  },
  {
    id: 'would-you-rather',
    name: 'Would You Rather?',
    mood: 'Fun',
    description: 'Pick a playful possibility.',
    rounds: [
      {
        prompt: 'Try something new together?',
        options: ['Dance class', 'Cooking class'],
      },
      {
        prompt: 'Unexpected rainy day?',
        options: ['Museum adventure', 'Board-game café'],
      },
      {
        prompt: 'A fictional superpower?',
        options: ['Speak every language', 'Teleport to any city'],
      },
    ],
  },
  {
    id: 'tiny-adventure',
    name: 'Our Tiny Adventure',
    mood: 'Fun',
    description: 'Co-write a fictional date in three scenes.',
    rounds: [
      {
        prompt:
          'We step into a café and something unexpected happens. Add your opening sentence.',
      },
      { prompt: 'Combine your openings and write what happens next.' },
      { prompt: 'Give your shared adventure a funny ending.' },
    ],
  },
  {
    id: 'flirt-or-funny',
    name: 'Flirt or Funny',
    mood: 'Flirty',
    description: 'A little charm, a little laughter. Both opt in.',
    rounds: [
      { prompt: 'Give our fictional first date a movie title.' },
      {
        prompt:
          'Write a warm or funny invitation to an imaginary dessert date.',
      },
      { prompt: 'Describe a small thoughtful gesture you would appreciate.' },
    ],
  },
  {
    id: 'compliment-exchange',
    name: 'Compliment Exchange',
    mood: 'Flirty',
    description: 'Notice something kind beyond appearance.',
    rounds: [
      {
        prompt:
          'What detail in their profile made you curious? A kind observation is enough.',
      },
      { prompt: 'Name something you appreciate about this conversation.' },
      { prompt: 'Finish: I would enjoy hearing more about…' },
    ],
  },
  {
    id: 'dream-weekend',
    name: 'Dream Weekend',
    mood: 'Get closer',
    description: 'Discover each other’s favourite pace.',
    rounds: [
      {
        prompt: 'Saturday morning?',
        options: ['Slow breakfast', 'Outdoor adventure', 'Creative project'],
      },
      {
        prompt: 'An afternoon together?',
        options: [
          'Explore a neighbourhood',
          'Cook together',
          'See an exhibition',
        ],
      },
      { prompt: 'What would make that weekend feel special to you?' },
    ],
  },
  {
    id: 'build-our-date',
    name: 'Build Our Date',
    mood: 'Get closer',
    description: 'Find shared choices, then optionally make a plan.',
    rounds: [
      {
        prompt: 'Pick a public first-date activity.',
        options: ['Coffee', 'Museum', 'Park walk'],
      },
      {
        prompt: 'What pace feels comfortable?',
        options: ['Short and relaxed', 'An afternoon', 'Decide together'],
      },
      {
        prompt:
          'What would make the date comfortable and enjoyable for you? No private addresses, please.',
      },
    ],
  },
];
export type GameSession = {
  id: string;
  game: DatingGame;
  inviter: string;
  invitee: string;
  status: 'waiting' | 'active' | 'completed' | 'declined' | 'left' | 'expired';
  expiresAt: number;
};
export type GameAnswer = {
  round: number;
  userId: string;
  answer: string;
  guess?: string;
};
export type GameView = {
  session: GameSession;
  isInviter: boolean;
  round: number;
  submitted: boolean;
  ownAnswer?: string;
  reveals: {
    round: number;
    mine: string;
    theirs: string;
    myGuess?: string;
    theirGuess?: string;
  }[];
};
export function gameView(
  session: GameSession,
  answers: GameAnswer[],
  userId: string,
  now = Date.now(),
): GameView {
  if (userId !== session.inviter && userId !== session.invitee)
    throw new Error('Not a participant');
  const partner =
    userId === session.inviter ? session.invitee : session.inviter;
  const reveals: GameView['reveals'] = [];
  for (let round = 0; round < session.game.rounds.length; round++) {
    const mine = answers.find((a) => a.round === round && a.userId === userId);
    const theirs = answers.find(
      (a) => a.round === round && a.userId === partner,
    );
    if (!mine || !theirs) break;
    reveals.push({
      round,
      mine: mine.answer,
      theirs: theirs.answer,
      myGuess: mine.guess,
      theirGuess: theirs.guess,
    });
  }
  const round = reveals.length;
  const mine = answers.find((a) => a.round === round && a.userId === userId);
  let status = session.status;
  if (status === 'active' && round === session.game.rounds.length)
    status = 'completed';
  if ((status === 'waiting' || status === 'active') && session.expiresAt <= now)
    status = 'expired';
  return {
    session: { ...session, status },
    isInviter: userId === session.inviter,
    round,
    submitted: !!mine,
    ownAnswer: mine?.answer,
    reveals,
  };
}
export function validGameAnswer(
  round: GameRound,
  answer: string,
  guess?: string,
) {
  return (
    answer === '[Skipped]' ||
    (answer.trim().length > 0 &&
      answer.length <= 500 &&
      (!round.options || round.options.includes(answer)) &&
      (!round.guess || (!!guess && !!round.options?.includes(guess))))
  );
}
