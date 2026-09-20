import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { requireConnectionReady } from '@/lib/server/profile-readiness';
import { notifyUser } from '@/lib/server/notifications';
import {
  datingGames,
  gameView,
  validGameAnswer,
  type GameSession,
  type GameAnswer,
  type DatingGame,
} from '@/lib/games';
export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
type Row = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  game_json: string;
  status: GameSession['status'];
  expires_at: number;
};
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), gameId: z.string().max(50) }),
  z.object({
    action: z.enum(['accept', 'decline', 'leave']),
    sessionId: z.string().max(100),
  }),
  z.object({
    action: z.literal('answer'),
    sessionId: z.string().max(100),
    round: z.number().int().min(0).max(10),
    answer: z.string().trim().min(1).max(500),
    guess: z.string().max(100).optional(),
  }),
]);
async function connection(
  db: ReturnType<typeof getDb>,
  id: string,
  userId: string,
) {
  return db
    .prepare(
      "SELECT matches.user_a_id, matches.user_b_id FROM conversations JOIN matches ON matches.id = conversations.match_id WHERE conversations.id = ? AND matches.status = 'active' AND (matches.user_a_id = ? OR matches.user_b_id = ?) LIMIT 1",
    )
    .bind(id, userId, userId)
    .first<{ user_a_id: string; user_b_id: string }>();
}
async function latest(
  db: ReturnType<typeof getDb>,
  id: string,
  userId: string,
) {
  const row = await db
    .prepare(
      'SELECT id, inviter_id, invitee_id, game_json, status, expires_at FROM game_sessions WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    )
    .bind(id)
    .first<Row>();
  if (!row) return null;
  const answers = await db
    .prepare(
      'SELECT round, user_id AS userId, answer, guess FROM game_answers WHERE session_id = ?',
    )
    .bind(row.id)
    .all<GameAnswer>();
  const session: GameSession = {
    id: row.id,
    game: JSON.parse(row.game_json) as DatingGame,
    inviter: row.inviter_id,
    invitee: row.invitee_id,
    status: row.status,
    expiresAt: row.expires_at,
  };
  const view = gameView(session, answers.results, userId);
  if (view.session.status !== row.status)
    await db
      .prepare(
        'UPDATE game_sessions SET status = ? WHERE id = ? AND status = ?',
      )
      .bind(view.session.status, row.id, row.status)
      .run();
  return view;
}
async function handle(request: Request, context: Context, mutation: boolean) {
  const input = mutation ? await readJson<unknown>(request) : null;
  if (input instanceof Response) return input;
  const parsed = mutation ? schema.safeParse(input) : null;
  if (parsed && !parsed.success)
    return json({ error: 'Invalid game action.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const match = await connection(db, id, user.id);
    if (!match)
      return json(
        { error: 'An accepted mutual match is required.' },
        { status: 404 },
      );
    if (!(await requireConnectionReady(db, user.id)))
      return json(
        { error: 'Complete and verify your profile to play.' },
        { status: 403 },
      );
    await db
      .prepare(
        "UPDATE game_sessions SET status = 'expired' WHERE conversation_id = ? AND status IN ('waiting','active') AND expires_at <= ?",
      )
      .bind(id, Date.now())
      .run();
    const view = await latest(db, id, user.id);
    if (!mutation) return json({ game: view });
    if (!parsed?.success)
      return json({ error: 'Invalid game action.' }, { status: 400 });
    const action = parsed.data;
    if (action.action === 'invite') {
      const game = datingGames.find((g) => g.id === action.gameId);
      if (!game) return json({ error: 'Game not found.' }, { status: 400 });
      if (view && ['waiting', 'active'].includes(view.session.status))
        return json(
          { error: 'Finish or leave the current game first.' },
          { status: 409 },
        );
      const recipient =
        match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
      const inserted = await db
        .prepare(
          "INSERT OR IGNORE INTO game_sessions (id,conversation_id,inviter_id,invitee_id,game_json,status,expires_at,created_at) VALUES (?,?,?,?,?,'waiting',?,?)",
        )
        .bind(
          identifier('game'),
          id,
          user.id,
          recipient,
          JSON.stringify(game),
          Date.now() + 24 * 3600000,
          Date.now(),
        )
        .run();
      if (Number(inserted.meta.changes) > 0)
        await notifyUser(db, {
          userId: recipient,
          type: 'message',
          title: 'An invitation to play together',
          body: `${game.name} · Accept only if you feel like playing.`,
          data: { url: `/?chat=${id}`, conversationId: id },
        });
    } else {
      if (!view || view.session.id !== action.sessionId)
        return json({ error: 'Game not found.' }, { status: 404 });
      if (
        ['completed', 'expired', 'declined', 'left'].includes(
          view.session.status,
        )
      )
        return json({ error: 'This game has ended.' }, { status: 409 });
      if (action.action === 'accept' || action.action === 'decline') {
        if (view.isInviter || view.session.status !== 'waiting')
          return json(
            { error: 'Only the invited match can respond.' },
            { status: 403 },
          );
        await db
          .prepare(
            "UPDATE game_sessions SET status = ?, expires_at = ? WHERE id = ? AND status = 'waiting'",
          )
          .bind(
            action.action === 'accept' ? 'active' : 'declined',
            Date.now() + 72 * 3600000,
            view.session.id,
          )
          .run();
      } else if (action.action === 'leave') {
        await db
          .prepare(
            "UPDATE game_sessions SET status = 'left' WHERE id = ? AND status IN ('waiting','active')",
          )
          .bind(view.session.id)
          .run();
      } else if (action.action === 'answer') {
        const round = view.session.game.rounds[view.round];
        if (
          view.session.status !== 'active' ||
          action.round !== view.round ||
          !round ||
          !validGameAnswer(round, action.answer, action.guess)
        )
          return json(
            { error: 'Answer the current round with a valid choice.' },
            { status: 409 },
          );
        await db
          .prepare(
            "INSERT OR IGNORE INTO game_answers (session_id,user_id,round,answer,guess,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM game_sessions WHERE id = ? AND status = 'active' AND expires_at > ?) AND EXISTS (SELECT 1 FROM conversations JOIN matches ON matches.id = conversations.match_id WHERE conversations.id = ? AND matches.status = 'active')",
          )
          .bind(
            view.session.id,
            user.id,
            view.round,
            action.answer,
            action.guess ?? null,
            Date.now(),
            view.session.id,
            Date.now(),
            id,
          )
          .run();
      }
    }
    return json({ game: await latest(db, id, user.id) });
  });
}
export function GET(request: Request, context: Context) {
  return handle(request, context, false);
}
export function POST(request: Request, context: Context) {
  return handle(request, context, true);
}
