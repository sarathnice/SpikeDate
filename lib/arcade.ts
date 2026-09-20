export const arcadeGames = [
  {
    id: 'four-row',
    name: 'Four in a Row',
    description: 'Take turns dropping pieces. Connect four to win.',
  },
  {
    id: 'bubble-duel',
    name: 'Bubble Duel',
    description: 'Pop connected matching bubbles. A friendly 45-second race.',
  },
  {
    id: 'guess-next',
    name: 'Guess Next',
    description: 'Both predict the next colour. Five quick rounds.',
  },
] as const;
export type ArcadeId = (typeof arcadeGames)[number]['id'];
export type ArcadeState = {
  id: string;
  game: ArcadeId;
  players: [string, string];
  status: 'waiting' | 'active' | 'completed' | 'declined' | 'left' | 'expired';
  revision: number;
  turn: number;
  board: number[];
  bubbles: number[][];
  scores: number[];
  predictions: (number | null)[];
  results: { colour: number; choices: number[] }[];
  winner: number | null;
  endsAt: number;
  moves: string[];
};
export type ArcadeCommand = {
  action:
    | 'invite'
    | 'accept'
    | 'decline'
    | 'leave'
    | 'drop'
    | 'pop'
    | 'predict';
  game?: ArcadeId;
  revision: number;
  moveId: string;
  position?: number;
  sessionId?: string;
  round?: number;
};
export function randomColour() {
  return crypto.getRandomValues(new Uint32Array(1))[0] % 2;
}
export function createArcade(
  game: ArcadeId,
  players: [string, string],
  revision: number,
  now: number,
  random = randomColour,
): ArcadeState {
  if (!arcadeGames.some((g) => g.id === game)) throw new Error('Unknown game.');
  // Two adjacent cells always share a colour, so every fresh board has playable groups.
  const board = Array.from({ length: 15 }, random).flatMap((c) => [c, c]);
  return {
    id: crypto.randomUUID(),
    game,
    players,
    status: 'waiting',
    revision,
    turn: 0,
    board: Array(42).fill(-1),
    bubbles: [board, [...board]],
    scores: [0, 0],
    predictions: [null, null],
    results: [],
    winner: null,
    endsAt: now + 10 * 60_000,
    moves: [],
  };
}
export function finishArcade(state: ArcadeState, now: number): ArcadeState {
  if (!['waiting', 'active'].includes(state.status) || state.endsAt > now)
    return state;
  const s = structuredClone(state);
  s.revision++;
  if (s.status === 'active' && s.game === 'bubble-duel') {
    s.status = 'completed';
    s.winner =
      s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1;
  } else s.status = 'expired';
  return s;
}
export function bubbleGroup(board: number[], position: number) {
  if (
    !Number.isInteger(position) ||
    position < 0 ||
    position >= 30 ||
    board[position] < 0
  )
    return [];
  const seen = new Set<number>(),
    pending = [position];
  while (pending.length) {
    const p = pending.pop()!;
    if (seen.has(p) || board[p] !== board[position]) continue;
    seen.add(p);
    if (p % 5) pending.push(p - 1);
    if (p % 5 < 4) pending.push(p + 1);
    if (p >= 5) pending.push(p - 5);
    if (p < 25) pending.push(p + 5);
  }
  return [...seen];
}
export function fourWinner(board: number[]) {
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 7; c++) {
      const value = board[r * 7 + c];
      if (value < 0) continue;
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        if (r + dr * 3 > 5 || c + dc * 3 > 6 || c + dc * 3 < 0) continue;
        if (
          [1, 2, 3].every((n) => board[(r + dr * n) * 7 + c + dc * n] === value)
        )
          return value;
      }
    }
  return null;
}
export function applyArcade(
  state: ArcadeState,
  user: string,
  command: ArcadeCommand,
  now: number,
  random = randomColour,
  bubbleSeconds = 45,
): ArcadeState {
  const player = state.players.indexOf(user);
  if (player < 0) throw new Error('Not a participant.');
  if (
    typeof command.moveId !== 'string' ||
    command.moveId.length < 1 ||
    command.moveId.length > 80
  )
    throw new Error('Invalid move identifier.');
  if (state.moves.includes(command.moveId)) return state;
  if (command.sessionId && command.sessionId !== state.id)
    throw new Error('This game has ended.');
  const independentMove =
    command.sessionId === state.id &&
    Number.isInteger(command.revision) &&
    command.revision >= 0 &&
    command.revision <= state.revision &&
    ((command.action === 'pop' && state.game === 'bubble-duel') ||
      (command.action === 'predict' &&
        state.game === 'guess-next' &&
        command.round === state.results.length));
  if (command.revision !== state.revision && !independentMove)
    throw new Error('Board changed. Try again.');
  if (state.endsAt <= now || !['waiting', 'active'].includes(state.status))
    throw new Error('This game has ended.');
  const s = structuredClone(state);
  if (command.action === 'leave') s.status = 'left';
  else if (command.action === 'accept' || command.action === 'decline') {
    if (player !== 1 || s.status !== 'waiting')
      throw new Error('Only the invited player can respond.');
    s.status = command.action === 'decline' ? 'declined' : 'active';
    s.endsAt =
      now +
      (s.game === 'bubble-duel'
        ? Math.max(
            10,
            Math.min(60, Number.isFinite(bubbleSeconds) ? bubbleSeconds : 45),
          ) * 1000
        : 30 * 60_000);
  } else {
    if (s.status !== 'active')
      throw new Error('Your partner must accept first.');
    const p = command.position;
    if (!Number.isInteger(p)) throw new Error('Choose a valid position.');
    if (command.action === 'drop' && s.game === 'four-row') {
      if (player !== s.turn) throw new Error('Wait for your turn.');
      if (p! < 0 || p! >= 7) throw new Error('Invalid column.');
      let r = 5;
      while (r >= 0 && s.board[r * 7 + p!] !== -1) r--;
      if (r < 0) throw new Error('That column is full.');
      s.board[r * 7 + p!] = player;
      s.turn = 1 - player;
      s.winner = fourWinner(s.board);
      if (s.winner !== null || !s.board.includes(-1)) s.status = 'completed';
    } else if (command.action === 'pop' && s.game === 'bubble-duel') {
      const group = bubbleGroup(s.bubbles[player], p!);
      if (group.length < 2)
        throw new Error('Choose two or more connected matching bubbles.');
      group.forEach((cell) => (s.bubbles[player][cell] = -1));
      s.scores[player] += group.length;
      if (
        s.bubbles.every((b) =>
          b.every((_, cell) => bubbleGroup(b, cell).length < 2),
        )
      ) {
        s.status = 'completed';
        s.winner =
          s.scores[0] === s.scores[1]
            ? null
            : s.scores[0] > s.scores[1]
              ? 0
              : 1;
      }
    } else if (command.action === 'predict' && s.game === 'guess-next') {
      if (![0, 1].includes(p!)) throw new Error('Choose coral or blue.');
      if (s.predictions[player] !== null)
        throw new Error('Your prediction is already locked.');
      s.predictions[player] = p!;
      if (s.predictions.every((choice) => choice !== null)) {
        const colour = random();
        s.results.push({ colour, choices: s.predictions as number[] });
        s.predictions.forEach((choice, i) => {
          if (choice === colour) s.scores[i]++;
        });
        s.predictions = [null, null];
        if (s.results.length === 5) {
          s.status = 'completed';
          s.winner =
            s.scores[0] === s.scores[1]
              ? null
              : s.scores[0] > s.scores[1]
                ? 0
                : 1;
        }
      }
    } else throw new Error('Invalid action for this game.');
  }
  s.revision++;
  s.moves = [...s.moves, command.moveId].slice(-100);
  return s;
}
export type ArcadeView = Omit<
  ArcadeState,
  'moves' | 'predictions' | 'bubbles'
> & { me: number; submitted: boolean; bubbleBoard: number[] };
export function arcadeView(s: ArcadeState, user: string): ArcadeView {
  const me = s.players.indexOf(user);
  if (me < 0) throw new Error('Not a participant.');
  const { moves: _moves, predictions, bubbles, ...rest } = s;
  return {
    ...rest,
    me,
    submitted: predictions[me] !== null,
    bubbleBoard: bubbles[me],
  };
}
