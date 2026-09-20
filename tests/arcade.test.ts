import { describe, expect, it } from 'vitest';
import {
  applyArcade,
  arcadeView,
  bubbleGroup,
  createArcade,
  finishArcade,
  fourWinner,
  type ArcadeCommand,
  type ArcadeState,
} from '../lib/arcade';
const now = 1000;
function command(
  s: ArcadeState,
  action: ArcadeCommand['action'],
  position?: number,
): ArcadeCommand {
  return {
    action,
    position,
    revision: s.revision,
    moveId: crypto.randomUUID(),
    sessionId: s.id,
    round: s.results.length,
  };
}
function active(game: ArcadeState['game']) {
  const s = createArcade(game, ['a', 'b'], 1, now, () => 0);
  return applyArcade(s, 'b', command(s, 'accept'), now);
}
describe('authoritative arcade rules', () => {
  it('accepts simultaneous independent predictions but rejects replay into the next round', () => {
    const s = active('guess-next'),
      ca = command(s, 'predict', 0),
      cb = command(s, 'predict', 1);
    let next = applyArcade(s, 'a', ca, now, () => 0);
    next = applyArcade(next, 'b', cb, now, () => 0);
    expect(next.results).toHaveLength(1);
    expect(() =>
      applyArcade(next, 'a', { ...ca, moveId: 'different-id' }, now),
    ).toThrow('changed');
  });
  it('a full board without four connected is a draw', () => {
    const s = active('four-row');
    s.board = Array.from(
      { length: 42 },
      (_, p) => ((Math.floor(p / 7) % 2) + Math.floor((p % 7) / 2)) % 2,
    );
    s.board[35] = -1;
    s.turn = 1;
    const next = applyArcade(s, 'b', command(s, 'drop', 0), now);
    expect(next.status).toBe('completed');
    expect(next.winner).toBeNull();
  });
  it('only the invited participant can accept; strangers cannot move', () => {
    const s = createArcade('four-row', ['a', 'b'], 1, now);
    expect(() => applyArcade(s, 'a', command(s, 'accept'), now)).toThrow(
      'invited',
    );
    expect(() => applyArcade(s, 'x', command(s, 'accept'), now)).toThrow(
      'participant',
    );
    expect(() => applyArcade(s, 'b', command(s, 'drop', 0), now)).toThrow(
      'accept',
    );
  });
  it('enforces turns, rejects stale moves and deduplicates retries', () => {
    const s = active('four-row'),
      c = command(s, 'drop', 0);
    const next = applyArcade(s, 'a', c, now);
    expect(applyArcade(next, 'a', c, now)).toEqual(next);
    expect(() => applyArcade(next, 'a', command(next, 'drop', 1), now)).toThrow(
      'turn',
    );
    expect(() => applyArcade(next, 'b', command(s, 'drop', 1), now)).toThrow(
      'changed',
    );
    expect(s.board.every((p) => p === -1)).toBe(true);
  });
  it('finishes a real winning turn sequence and rejects further moves', () => {
    let s = active('four-row');
    for (const col of [0, 1, 0, 1, 0, 1, 0])
      s = applyArcade(s, s.players[s.turn], command(s, 'drop', col), now);
    expect(s.status).toBe('completed');
    expect(s.winner).toBe(0);
    expect(() => applyArcade(s, 'b', command(s, 'drop', 2), now)).toThrow(
      'ended',
    );
  });
  it.each([
    [35, 36, 37, 38],
    [0, 7, 14, 21],
    [0, 8, 16, 24],
    [6, 12, 18, 24],
  ])('detects four in direction %j', (...cells) => {
    const board = Array(42).fill(-1);
    cells.forEach((cell) => (board[cell] = 1));
    expect(fourWinner(board)).toBe(1);
  });
  it('rejects full columns and out-of-board coordinates', () => {
    let s = active('four-row');
    for (let n = 0; n < 6; n++)
      s = applyArcade(s, s.players[s.turn], command(s, 'drop', 0), now);
    expect(() => applyArcade(s, 'a', command(s, 'drop', 0), now)).toThrow(
      'full',
    );
    expect(() => applyArcade(s, 'a', command(s, 'drop', 7), now)).toThrow(
      'column',
    );
  });
  it('hides locked predictions and generates the outcome only after both submit', () => {
    let s = active('guess-next');
    let calls = 0;
    s = applyArcade(s, 'a', command(s, 'predict', 0), now, () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(0);
    expect(arcadeView(s, 'b')).not.toHaveProperty('predictions');
    expect(arcadeView(s, 'b').submitted).toBe(false);
    expect(s.results).toHaveLength(0);
    expect(() => applyArcade(s, 'a', command(s, 'predict', 1), now)).toThrow(
      'locked',
    );
    s = applyArcade(s, 'b', command(s, 'predict', 1), now, () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(1);
    expect(s.scores).toEqual([1, 0]);
  });
  it('completes five Guess Next rounds and calculates the winner', () => {
    let s = active('guess-next');
    for (let n = 0; n < 5; n++) {
      s = applyArcade(s, 'a', command(s, 'predict', 0), now, () => 0);
      s = applyArcade(s, 'b', command(s, 'predict', 1), now, () => 0);
    }
    expect(s.status).toBe('completed');
    expect(s.results).toHaveLength(5);
    expect(s.winner).toBe(0);
  });
  it('scores only connected bubbles; one player cannot modify the other board', () => {
    const s = active('bubble-duel');
    const next = applyArcade(s, 'a', command(s, 'pop', 0), now);
    expect(next.scores).toEqual([30, 0]);
    expect(next.bubbles[1]).toEqual(s.bubbles[1]);
    expect(() => applyArcade(next, 'a', command(next, 'pop', 0), now)).toThrow(
      'connected',
    );
    expect(bubbleGroup(s.bubbles[0], 30)).toEqual([]);
  });
  it('bubble timeout chooses winner and persists a tie correctly', () => {
    let s = active('bubble-duel');
    s = applyArcade(s, 'a', command(s, 'pop', 0), now);
    const finished = finishArcade(s, s.endsAt);
    expect(finished.status).toBe('completed');
    expect(finished.winner).toBe(0);
    expect(finishArcade(active('bubble-duel'), now + 45000).winner).toBeNull();
  });
  it('decline, leave and invitation expiry do not change the match', () => {
    const s = createArcade('four-row', ['a', 'b'], 1, now);
    expect(applyArcade(s, 'b', command(s, 'decline'), now).status).toBe(
      'declined',
    );
    const started = active('four-row');
    expect(
      applyArcade(started, 'b', command(started, 'leave'), now).status,
    ).toBe('left');
    expect(finishArcade(s, s.endsAt).status).toBe('expired');
  });
});
