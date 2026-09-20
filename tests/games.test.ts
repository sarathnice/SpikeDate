import { describe, it, expect } from 'vitest';
import {
  datingGames,
  gameView,
  validGameAnswer,
  type GameSession,
} from '../lib/games';
const session: GameSession = {
  id: 'session',
  inviter: 'alex',
  invitee: 'lena',
  game: datingGames[0],
  status: 'active',
  expiresAt: 2000,
};
describe('ten dating games', () => {
  it('has ten unique original three-round games', () => {
    expect(datingGames).toHaveLength(10);
    expect(new Set(datingGames.map((g) => g.id)).size).toBe(10);
    for (const game of datingGames) expect(game.rounds).toHaveLength(3);
  });
  it('never returns the partner answer until both submit', () => {
    const view = gameView(
      session,
      [{ round: 0, userId: 'lena', answer: 'SECRET' }],
      'alex',
      1000,
    );
    expect(JSON.stringify(view)).not.toContain('SECRET');
    expect(view.reveals).toHaveLength(0);
  });
  it('reveals reciprocal answers and advances exactly one round', () => {
    const view = gameView(
      session,
      [
        { round: 0, userId: 'alex', answer: 'Coffee' },
        { round: 0, userId: 'lena', answer: 'Dessert' },
      ],
      'alex',
      1000,
    );
    expect(view.round).toBe(1);
    expect(view.reveals[0]).toMatchObject({
      mine: 'Coffee',
      theirs: 'Dessert',
    });
  });
  it('completes only after every round has two answers', () => {
    const answers = session.game.rounds.flatMap((_, round) =>
      ['alex', 'lena'].map((userId) => ({
        round,
        userId,
        answer: '[Skipped]',
      })),
    );
    expect(gameView(session, answers, 'alex', 1000).session.status).toBe(
      'completed',
    );
  });
  it('expires pending and active games, but preserves completed results', () => {
    expect(gameView(session, [], 'alex', 2000).session.status).toBe('expired');
    expect(
      gameView({ ...session, status: 'waiting' }, [], 'alex', 2000).session
        .status,
    ).toBe('expired');
    expect(
      gameView({ ...session, status: 'completed' }, [], 'alex', 2000).session
        .status,
    ).toBe('completed');
  });
  it('rejects non-participants and ignores unrelated answers', () => {
    expect(() => gameView(session, [], 'intruder', 1000)).toThrow();
    expect(
      gameView(
        session,
        [{ round: 0, userId: 'intruder', answer: 'SECRET' }],
        'alex',
        1000,
      ).reveals,
    ).toHaveLength(0);
  });
  it('validates choices, text, guesses and skips', () => {
    expect(validGameAnswer(session.game.rounds[0], 'Other')).toBe(false);
    expect(validGameAnswer(session.game.rounds[0], '[Skipped]')).toBe(true);
    expect(validGameAnswer({ prompt: 'Text' }, ' ')).toBe(false);
    expect(validGameAnswer({ prompt: 'Text' }, 'x'.repeat(501))).toBe(false);
    expect(validGameAnswer(datingGames[1].rounds[0], 'Bookshop')).toBe(false);
    expect(
      validGameAnswer(datingGames[1].rounds[0], 'Bookshop', 'Art gallery'),
    ).toBe(true);
  });
});
