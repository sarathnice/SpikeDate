'use client';
import { useCallback, useEffect, useState } from 'react';
import { Gamepad2, ChevronRight } from 'lucide-react';
import { ArcadeGames } from '@/components/arcade-games';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  datingGames,
  gameView,
  validGameAnswer,
  type GameAnswer,
  type GameMood,
  type GameSession,
  type GameView,
} from '@/lib/games';

type Action = {
  action: 'invite' | 'accept' | 'decline' | 'leave' | 'answer';
  gameId?: string;
  sessionId?: string;
  round?: number;
  answer?: string;
  guess?: string;
};
type Stored = { session: GameSession; answers: GameAnswer[] };
export function DatingGames({
  conversationId,
  viewerId,
  partnerId,
  partnerName,
  serverEnabled,
  onPlan,
  preview = false,
}: {
  conversationId?: string;
  viewerId: string;
  partnerId: string;
  partnerName: string;
  serverEnabled: boolean;
  onPlan?: () => void;
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<'Conversation' | 'Arcade'>(
    'Conversation',
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const [view, setView] = useState<GameView | null>(null);
  const [mood, setMood] = useState<GameMood | 'All'>('All');
  const [answer, setAnswer] = useState('');
  const [guess, setGuess] = useState('');
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState('');
  const storageKey =
    'spikedate-game-demo:' + [viewerId, partnerId].sort().join('|');
  const request = useCallback(
    async (action?: Action) => {
      if (serverEnabled) {
        if (!conversationId)
          throw new Error('Games require an accepted match conversation.');
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/games`,
          action
            ? {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action),
              }
            : undefined,
        );
        const data = (await response.json()) as {
          game: GameView | null;
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error ?? 'Unable to load games.');
        return data.game;
      }
      let stored: Stored | null = JSON.parse(
        localStorage.getItem(storageKey) ?? 'null',
      );
      const current = stored
        ? gameView(stored.session, stored.answers, viewerId)
        : null;
      if (action) {
        if (action.action === 'invite') {
          if (current && ['waiting', 'active'].includes(current.session.status))
            throw new Error('Finish or leave the current game first.');
          const game = datingGames.find((g) => g.id === action.gameId);
          if (!game) throw new Error('Game not found.');
          stored = {
            session: {
              id: crypto.randomUUID(),
              game,
              inviter: viewerId,
              invitee: partnerId,
              status: 'waiting',
              expiresAt: Date.now() + 24 * 3600000,
            },
            answers: [],
          };
        } else {
          if (
            !stored ||
            !current ||
            action.sessionId !== current.session.id ||
            !['waiting', 'active'].includes(current.session.status)
          )
            throw new Error('This game has ended.');
          if (action.action === 'accept' || action.action === 'decline') {
            if (current.isInviter || current.session.status !== 'waiting')
              throw new Error('Only the invited match can respond.');
            stored.session.status =
              action.action === 'accept' ? 'active' : 'declined';
            stored.session.expiresAt = Date.now() + 72 * 3600000;
          } else if (action.action === 'leave') stored.session.status = 'left';
          else {
            const round = current.session.game.rounds[current.round];
            if (
              current.session.status !== 'active' ||
              action.round !== current.round ||
              !round ||
              !validGameAnswer(round, action.answer ?? '', action.guess)
            )
              throw new Error('Answer the current round.');
            if (!current.submitted)
              stored.answers.push({
                round: current.round,
                userId: viewerId,
                answer: action.answer!,
                guess: action.guess,
              });
          }
        }
        localStorage.setItem(storageKey, JSON.stringify(stored));
      }
      return stored ? gameView(stored.session, stored.answers, viewerId) : null;
    },
    [serverEnabled, conversationId, storageKey, viewerId, partnerId],
  );
  useEffect(() => {
    let cancelled = false;
    if (open && category === 'Arcade') return;
    let loading = false;
    const load = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const data = await request();
        if (!cancelled) setView(data);
      } catch (e) {
        if (!cancelled && open)
          setError(e instanceof Error ? e.message : 'Unable to load games.');
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), open ? 5000 : 30000);
    const refresh = () => void load();
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [request, open, category]);
  useEffect(() => {
    setAnswer('');
    setGuess('');
  }, [view?.round, view?.session.id, viewerId]);
  async function act(action: Action) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setView(await request(action));
      setBrowsing(false);
      setAnswer('');
      setGuess('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update game.');
    } finally {
      setBusy(false);
    }
  }
  const playing =
    !!view && ['waiting', 'active', 'completed'].includes(view.session.status);
  const round = view?.session.game.rounds[view.round];
  return (
    <div className="dating-games">
      <button
        className="play-together-button"
        disabled={!ready}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        <Gamepad2 size={18} />
        {view?.session.status === 'waiting'
          ? view.isInviter
            ? 'Game invitation sent'
            : 'Game invitation'
          : view?.session.status === 'active'
            ? 'Continue game'
            : 'Play together'}
        <ChevronRight size={16} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="games-dialog">
          <DialogTitle>Play Together</DialogTitle>
          <DialogDescription>
            Play a quick game or discover something new about each other.
          </DialogDescription>
          <div className="game-moods" aria-label="Game categories">
            {(['Conversation', 'Arcade'] as const).map((tab) => (
              <button
                key={tab}
                aria-pressed={category === tab}
                onClick={() => setCategory(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {category === 'Arcade' ? (
            <ArcadeGames
              conversationId={conversationId}
              serverEnabled={serverEnabled}
              partnerName={partnerName}
            />
          ) : (
            <>
              {!serverEnabled && (
                <p className="games-demo-label">
                  {preview ? 'Two-player interactive preview' : 'Local demo'} ·
                  No real invitation is sent.
                </p>
              )}
              {error && (
                <p role="alert" className="games-error">
                  {error}
                </p>
              )}
              {playing && view && !browsing ? (
                <section className="game-session" aria-label="Current game">
                  <div className="game-heading">
                    <Gamepad2 size={24} />
                    <div>
                      <small>{view.session.game.mood}</small>
                      <h2>{view.session.game.name}</h2>
                    </div>
                  </div>
                  {view.session.status === 'waiting' && (
                    <>
                      <p>
                        {view.isInviter
                          ? `Waiting for ${partnerName} to accept.`
                          : `${partnerName} invited you to play.`}
                      </p>
                      <p>
                        {view.session.game.description} Accept only if this mood
                        feels comfortable. Invitations expire after 24 hours.
                      </p>
                      {!view.isInviter && (
                        <div className="game-buttons">
                          <button
                            disabled={busy}
                            className="game-primary"
                            onClick={() =>
                              void act({
                                action: 'accept',
                                sessionId: view.session.id,
                              })
                            }
                          >
                            Accept game
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: 'decline',
                                sessionId: view.session.id,
                              })
                            }
                          >
                            Not now
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {view.session.status === 'active' && round && (
                    <>
                      <p className="game-progress">
                        Round {view.round + 1} of{' '}
                        {view.session.game.rounds.length}
                      </p>
                      <h3>{round.prompt}</h3>
                      {view.submitted ? (
                        <p role="status">
                          Answer saved. Waiting for {partnerName}. Their answer
                          stays private until both reply.
                        </p>
                      ) : (
                        <>
                          {round.options ? (
                            <div
                              className="game-options"
                              aria-label="Your choice"
                            >
                              {round.options.map((option) => (
                                <button
                                  key={option}
                                  aria-pressed={answer === option}
                                  onClick={() => setAnswer(option)}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <label className="game-text-label">
                              Your answer
                              <textarea
                                aria-label="Your game answer"
                                value={answer}
                                maxLength={500}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Keep it light. Share only what feels comfortable."
                              />
                              <small>{answer.length}/500</small>
                            </label>
                          )}
                          {round.guess && (
                            <label className="game-guess">
                              Guess {partnerName}&apos;s choice
                              <select
                                aria-label="Guess partner choice"
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                              >
                                <option value="">Choose a guess</option>
                                {round.options?.map((o) => (
                                  <option key={o}>{o}</option>
                                ))}
                              </select>
                            </label>
                          )}
                          <div className="game-buttons">
                            <button
                              className="game-primary"
                              disabled={
                                busy || !validGameAnswer(round, answer, guess)
                              }
                              onClick={() =>
                                void act({
                                  action: 'answer',
                                  sessionId: view.session.id,
                                  round: view.round,
                                  answer,
                                  guess: guess || undefined,
                                })
                              }
                            >
                              Lock my answer
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void act({
                                  action: 'answer',
                                  sessionId: view.session.id,
                                  round: view.round,
                                  answer: '[Skipped]',
                                })
                              }
                            >
                              Skip question
                            </button>
                          </div>
                          <small>
                            Answers reveal only when both reply. You can keep
                            chatting.
                          </small>
                        </>
                      )}
                    </>
                  )}
                  {!!view.reveals.length && (
                    <section
                      className="game-reveals"
                      aria-label="Revealed answers"
                    >
                      <h3>
                        {view.session.status === 'completed'
                          ? 'Your shared moments'
                          : 'Revealed together'}
                      </h3>
                      {view.reveals.map((reveal) => (
                        <article key={reveal.round}>
                          <small>Round {reveal.round + 1}</small>
                          <p>{view.session.game.rounds[reveal.round].prompt}</p>
                          <div>
                            <span>You</span>
                            <p>{reveal.mine}</p>
                          </div>
                          <div>
                            <span>{partnerName}</span>
                            <p>{reveal.theirs}</p>
                          </div>
                          {reveal.myGuess && (
                            <small>
                              Your guess: {reveal.myGuess} ·{' '}
                              {reveal.myGuess === reveal.theirs
                                ? 'You guessed their pick!'
                                : 'Something new to learn.'}
                            </small>
                          )}
                        </article>
                      ))}
                    </section>
                  )}
                  {view.session.status === 'completed' ? (
                    <>
                      <p>
                        No relationship score—just more to talk about. Which
                        answer surprised you?
                      </p>
                      <div className="game-buttons">
                        <button
                          className="game-primary"
                          onClick={() => setOpen(false)}
                        >
                          Continue chatting
                        </button>
                        {view.session.game.id === 'build-our-date' &&
                          onPlan && (
                            <button
                              onClick={() => {
                                setOpen(false);
                                onPlan();
                              }}
                            >
                              Create a date plan
                            </button>
                          )}
                        <button onClick={() => setBrowsing(true)}>
                          Browse games
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="game-leave"
                      disabled={busy}
                      onClick={() =>
                        void act({
                          action: 'leave',
                          sessionId: view.session.id,
                        })
                      }
                    >
                      Leave game · keep your match
                    </button>
                  )}
                </section>
              ) : (
                <>
                  {view && (
                    <p role="status">
                      Game {view.session.status}. You can keep chatting or
                      invite a new game.
                    </p>
                  )}
                  <div className="game-moods" aria-label="Game mood">
                    {(['All', 'Fun', 'Flirty', 'Get closer'] as const).map(
                      (m) => (
                        <button
                          key={m}
                          aria-pressed={mood === m}
                          onClick={() => setMood(m)}
                        >
                          {m}
                        </button>
                      ),
                    )}
                  </div>
                  <p className="game-picker-tip">
                    Choose a mood you both enjoy. Every invitation needs
                    acceptance; any question can be skipped.
                  </p>
                  <div className="game-catalog">
                    {datingGames
                      .filter((g) => mood === 'All' || g.mood === mood)
                      .map((game) => (
                        <button
                          key={game.id}
                          disabled={busy}
                          onClick={() =>
                            void act({ action: 'invite', gameId: game.id })
                          }
                        >
                          <span>
                            <small>{game.mood} · 3 rounds</small>
                            <strong>{game.name}</strong>
                            <p>{game.description}</p>
                          </span>
                          <ChevronRight size={18} />
                        </button>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
