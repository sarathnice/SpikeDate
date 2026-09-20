'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { arcadeGames, type ArcadeCommand, type ArcadeView } from '@/lib/arcade';
type LiveState = {
  type: 'state';
  revision: number;
  online: string[];
  game: ArcadeView | null;
};
export function ArcadeGames({
  conversationId,
  serverEnabled,
  partnerName,
}: {
  conversationId?: string;
  serverEnabled: boolean;
  partnerName: string;
}) {
  const socket = useRef<WebSocket | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!serverEnabled || !conversationId) return;
    let stopped = false;
    let reconnect: ReturnType<typeof setTimeout>;
    let retries = 0;
    const connect = () => {
      const ws = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/arcade/live?conversationId=${encodeURIComponent(conversationId)}`,
      );
      socket.current = ws;
      ws.onmessage = (event) => {
        if (stopped) return;
        const message = JSON.parse(event.data) as
          | LiveState
          | { type: 'error'; error: string };
        if (message.type === 'state') {
          setLive(message);
          setConnected(true);
          setPending(false);
          retries = 0;
        } else {
          setError(message.error);
          setPending(false);
        }
      };
      ws.onclose = (event) => {
        if (stopped) return;
        setConnected(false);
        setPending(false);
        if (event.code === 1008) {
          setError(event.reason || 'Sign in again or check your match.');
          return;
        }
        if (retries++ < 4)
          reconnect = setTimeout(connect, Math.min(1000 * retries, 4000));
        else
          setError(
            'Unable to connect. Check that Arcade is enabled on this deployment.',
          );
      };
      ws.onerror = () => {
        if (!stopped) setConnected(false);
      };
    };
    setLive(null);
    setConnected(false);
    setError('');
    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnect);
      socket.current?.close();
    };
  }, [conversationId, serverEnabled, attempt]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const send = useCallback(
    (command: Pick<ArcadeCommand, 'action' | 'game' | 'position'>) => {
      if (!live || socket.current?.readyState !== WebSocket.OPEN) return;
      setError('');
      setPending(true);
      socket.current.send(
        JSON.stringify({
          ...command,
          revision: live.revision,
          sessionId: live.game?.id,
          round: live.game?.results.length,
          moveId: crypto.randomUUID(),
        }),
      );
    },
    [live],
  );
  if (!serverEnabled || !conversationId)
    return (
      <p className="games-demo-label">
        Arcade requires two signed-in users with an accepted match. Conversation
        previews remain available in the other tab.
      </p>
    );
  const game = live?.game;
  const playing = game && ['waiting', 'active'].includes(game.status);
  const disabled = !connected || pending;
  return (
    <section className="arcade-panel" aria-label="Live arcade">
      <div className="arcade-connection" role="status">
        {connected
          ? `Live · ${live?.online.length ?? 0} of 2 players connected`
          : 'Connecting…'}
      </div>
      {!connected && (
        <button
          className="arcade-button"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Reconnect
        </button>
      )}
      {error && (
        <p className="games-error" role="alert">
          {error}
        </p>
      )}
      {game && (
        <>
          <h2>{arcadeGames.find((g) => g.id === game.game)?.name}</h2>
          {game.status === 'waiting' && (
            <>
              <p>
                {game.me === 0
                  ? `Waiting for ${partnerName} to accept.`
                  : `${partnerName} invited you to play.`}
              </p>
              {game.me === 1 && (
                <div className="game-buttons">
                  <button
                    disabled={disabled}
                    onClick={() => send({ action: 'accept' })}
                  >
                    Accept game
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() => send({ action: 'decline' })}
                  >
                    Not now
                  </button>
                </div>
              )}
            </>
          )}
          {['active', 'completed'].includes(game.status) &&
            game.game === 'four-row' && (
              <>
                <p role="status">
                  {game.status === 'completed'
                    ? 'Final board'
                    : game.turn === game.me
                      ? 'Your turn'
                      : `${partnerName}’s turn`}{' '}
                  · You are {game.me === 0 ? 'coral ●' : 'blue ◆'}
                </p>
                <div className="arcade-four" aria-label="Four in a Row board">
                  {Array.from({ length: 7 }, (_, col) => (
                    <button
                      key={col}
                      aria-label={`Drop in column ${col + 1}`}
                      disabled={
                        disabled ||
                        game.status !== 'active' ||
                        game.turn !== game.me ||
                        game.board[col] !== -1
                      }
                      onClick={() => send({ action: 'drop', position: col })}
                    >
                      {Array.from({ length: 6 }, (_, row) => {
                        const cell = game.board[row * 7 + col];
                        return (
                          <span key={row} data-piece={cell}>
                            {cell === 0 ? '●' : cell === 1 ? '◆' : ''}
                          </span>
                        );
                      })}
                    </button>
                  ))}
                </div>
              </>
            )}
          {game.game !== 'four-row' && (
            <div className="arcade-scores" aria-label="Scores">
              <span>
                You: <b>{game.scores[game.me]}</b>
              </span>
              <span>
                {partnerName}: <b>{game.scores[1 - game.me]}</b>
              </span>
            </div>
          )}
          {game.status === 'active' && game.game === 'bubble-duel' && (
            <>
              <p role="status">
                {Math.max(0, Math.ceil((game.endsAt - now) / 1000))} seconds ·
                Pop groups of 2+. Same starting board for both players.
              </p>
              <div className="arcade-bubbles" aria-label="Your bubble board">
                {game.bubbleBoard.map((colour, p) => (
                  <button
                    key={p}
                    data-colour={colour}
                    aria-label={`Pop bubble ${p + 1}`}
                    disabled={disabled || colour < 0 || now >= game.endsAt}
                    onClick={() => send({ action: 'pop', position: p })}
                  >
                    {colour === 0 ? '●' : colour === 1 ? '◆' : ''}
                  </button>
                ))}
              </div>
            </>
          )}
          {game.status === 'active' && game.game === 'guess-next' && (
            <>
              <p>
                Round {game.results.length + 1} of 5 · What colour comes next?
              </p>
              <div className="game-options">
                <button
                  disabled={disabled || game.submitted}
                  onClick={() => send({ action: 'predict', position: 0 })}
                >
                  Coral ●
                </button>
                <button
                  disabled={disabled || game.submitted}
                  onClick={() => send({ action: 'predict', position: 1 })}
                >
                  Blue ◆
                </button>
              </div>
              {game.submitted && (
                <p role="status">
                  Prediction locked. Waiting for {partnerName}.
                </p>
              )}
            </>
          )}
          {game.game === 'guess-next' && (
            <ol className="arcade-results" aria-label="Revealed rounds">
              {game.results.map((r, i) => (
                <li key={i}>
                  Round {i + 1}: {r.colour === 0 ? 'Coral ●' : 'Blue ◆'} ·{' '}
                  {r.choices[game.me] === r.colour
                    ? 'You guessed it'
                    : 'Next round, new chance'}
                </li>
              ))}
            </ol>
          )}
          {!playing && (
            <p className="arcade-outcome" role="status">
              {game.status === 'completed'
                ? game.winner === null
                  ? 'It’s a tie. Well played!'
                  : game.winner === game.me
                    ? 'You won! Keep the conversation going.'
                    : `${partnerName} won! Fancy a rematch?`
                : `Game ${game.status}. Your match is unchanged.`}
            </p>
          )}
          {playing && (
            <button
              className="arcade-button"
              disabled={disabled}
              onClick={() => send({ action: 'leave' })}
            >
              Leave game · keep your match
            </button>
          )}
        </>
      )}
      {!playing && (
        <div className="game-catalog">
          {arcadeGames.map((g) => (
            <button
              key={g.id}
              disabled={disabled}
              onClick={() => send({ action: 'invite', game: g.id })}
            >
              <span>
                <strong>{g.name}</strong>
                <p>{g.description}</p>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <p className="game-picker-tip">
        Friendly play only. No wagers or compatibility scores. Either player can
        decline or leave.
      </p>
    </section>
  );
}
