import { DurableObject } from 'cloudflare:workers';
import type { D1DatabaseLike } from './db';
import { currentUser } from './auth';
import { requireConnectionReady } from './profile-readiness';
import { notifyUser } from './notifications';
import {
  applyArcade,
  arcadeView,
  createArcade,
  finishArcade,
  type ArcadeCommand,
  type ArcadeState,
} from '../arcade';
export type ArcadeEnv = {
  DB: D1DatabaseLike;
  ARCADE_ROOMS: DurableObjectNamespace;
  SPIKEDATE_ARCADE_ENABLED?: string;
  SPIKEDATE_ARCADE_BUBBLE_SECONDS?: string;
};
type Identity = { userId: string; conversationId: string; tokenCookie: string };
export async function arcadeConnection(
  db: D1DatabaseLike,
  conversationId: string,
  userId: string,
) {
  return db
    .prepare(
      "SELECT m.user_a_id, m.user_b_id FROM conversations c JOIN matches m ON m.id = c.match_id JOIN users a ON a.id = m.user_a_id JOIN users b ON b.id = m.user_b_id WHERE c.id = ? AND m.status = 'active' AND a.status = 'active' AND b.status = 'active' AND (m.user_a_id = ? OR m.user_b_id = ?) AND NOT EXISTS(SELECT 1 FROM safety_actions WHERE kind = 'block' AND ((reporter_id = m.user_a_id AND subject_id = m.user_b_id) OR (reporter_id = m.user_b_id AND subject_id = m.user_a_id)))",
    )
    .bind(conversationId, userId, userId)
    .first<{ user_a_id: string; user_b_id: string }>();
}
export async function handleArcade(request: Request, env: ArcadeEnv) {
  if (env.SPIKEDATE_ARCADE_ENABLED !== 'true')
    return new Response('Arcade is disabled.', { status: 503 });
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
    return new Response('WebSocket required.', { status: 426 });
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin)
    return new Response('Invalid origin.', { status: 403 });
  const user = await currentUser(request, env.DB);
  if (!user) return new Response('Sign in required.', { status: 401 });
  const id = url.searchParams.get('conversationId') ?? '';
  const match = await arcadeConnection(env.DB, id, user.id);
  if (!match) return new Response('Accepted match required.', { status: 404 });
  if (!(await requireConnectionReady(env.DB, user.id)))
    return new Response('Complete verification first.', { status: 403 });
  // Replace all identity headers: only this authenticated gateway selects participants.
  const headers = new Headers({
    Upgrade: 'websocket',
    'x-user-id': user.id,
    'x-conversation-id': id,
    'x-partner-id':
      match.user_a_id === user.id ? match.user_b_id : match.user_a_id,
    cookie: request.headers.get('cookie') ?? '',
  });
  return env.ARCADE_ROOMS.get(env.ARCADE_ROOMS.idFromName(id)).fetch(
    new Request('https://arcade.internal/connect', { headers }),
  );
}
export class ArcadeRoom extends DurableObject<ArcadeEnv> {
  private game: ArcadeState | null = null;
  private room: { id: string; players: [string, string] } | null = null;
  private revision = 0;
  constructor(ctx: DurableObjectState, env: ArcadeEnv) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.game = (await ctx.storage.get<ArcadeState>('game')) ?? null;
      this.room =
        (await ctx.storage.get<{ id: string; players: [string, string] }>(
          'room',
        )) ?? null;
      this.revision = this.game?.revision ?? 0;
    });
  }
  async fetch(request: Request) {
    const userId = request.headers.get('x-user-id')!,
      conversationId = request.headers.get('x-conversation-id')!,
      partner = request.headers.get('x-partner-id')!;
    return this.ctx.blockConcurrencyWhile(async () => {
      if (!this.room) {
        this.room = { id: conversationId, players: [userId, partner] };
        await this.ctx.storage.put('room', this.room);
      }
      if (
        this.room.id !== conversationId ||
        !this.room.players.includes(userId) ||
        !this.room.players.includes(partner)
      )
        return new Response('Wrong room.', { status: 403 });
      if (
        this.ctx
          .getWebSockets()
          .filter(
            (ws) => (ws.deserializeAttachment() as Identity).userId === userId,
          ).length >= 4
      )
        return new Response('Too many open game connections.', { status: 429 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({
        userId,
        conversationId,
        tokenCookie: request.headers.get('cookie') ?? '',
      } satisfies Identity);
      await this.expire();
      this.broadcast();
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
  }
  private send(ws: WebSocket, value: unknown) {
    try {
      ws.send(JSON.stringify(value));
    } catch {
      /* Closed connection; reconnect restores stored state. */
    }
  }
  private broadcast() {
    const sockets = this.ctx.getWebSockets();
    const online = [
      ...new Set(
        sockets.map((ws) => (ws.deserializeAttachment() as Identity).userId),
      ),
    ];
    for (const ws of sockets)
      this.send(ws, {
        type: 'state',
        revision: this.revision,
        online,
        game: this.game
          ? arcadeView(
              this.game,
              (ws.deserializeAttachment() as Identity).userId,
            )
          : null,
      });
  }
  private async save() {
    this.revision = this.game?.revision ?? this.revision;
    await this.ctx.storage.put('game', this.game);
    if (this.game && ['waiting', 'active'].includes(this.game.status))
      await this.ctx.storage.setAlarm(this.game.endsAt);
    else await this.ctx.storage.deleteAlarm();
  }
  private async expire() {
    if (!this.game) return;
    const next = finishArcade(this.game, Date.now());
    if (next !== this.game) {
      this.game = next;
      await this.save();
    }
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (typeof raw !== 'string' || raw.length > 1024)
          throw new Error('Invalid message.');
        const identity = ws.deserializeAttachment() as Identity;
        if (this.env.SPIKEDATE_ARCADE_ENABLED !== 'true') {
          ws.close(1008, 'Arcade is disabled.');
          return;
        }
        const auth = await currentUser(
          new Request('https://arcade.internal', {
            headers: { cookie: identity.tokenCookie },
          }),
          this.env.DB,
        );
        if (!auth || auth.id !== identity.userId) {
          ws.close(1008, 'Sign in again.');
          return;
        }
        if (
          !(await arcadeConnection(
            this.env.DB,
            identity.conversationId,
            identity.userId,
          ))
        ) {
          if (this.game && ['waiting', 'active'].includes(this.game.status)) {
            this.game.status = 'left';
            this.game.revision++;
            await this.save();
          }
          this.broadcast();
          for (const socket of this.ctx.getWebSockets())
            socket.close(1008, 'This connection is no longer available.');
          return;
        }
        await this.expire();
        const command = JSON.parse(raw) as ArcadeCommand;
        if (command.action === 'invite') {
          if (this.game?.moves.includes(command.moveId)) {
            this.broadcast();
            return;
          }
          if (command.revision !== this.revision)
            throw new Error('Board changed. Try again.');
          if (this.game && ['waiting', 'active'].includes(this.game.status))
            throw new Error('Finish or leave the current game first.');
          if (
            typeof command.moveId !== 'string' ||
            !command.moveId ||
            command.moveId.length > 80
          )
            throw new Error('Invalid move identifier.');
          const partner = this.room!.players.find(
            (p) => p !== identity.userId,
          )!;
          this.game = createArcade(
            command.game!,
            [identity.userId, partner],
            this.revision + 1,
            Date.now(),
          );
          this.game.moves.push(command.moveId);
        } else {
          if (!this.game) throw new Error('Invite a game first.');
          this.game = applyArcade(
            this.game,
            identity.userId,
            command,
            Date.now(),
            undefined,
            Number(this.env.SPIKEDATE_ARCADE_BUBBLE_SECONDS ?? 45),
          );
        }
        await this.save();
        this.broadcast();
        if (command.action === 'invite') {
          try {
            await notifyUser(this.env.DB, {
              userId: this.game!.players[1],
              type: 'message',
              title: 'An invitation to play together',
              body: `${this.game!.game === 'four-row' ? 'Four in a Row' : this.game!.game === 'bubble-duel' ? 'Bubble Duel' : 'Guess Next'} · Accept only if you feel like playing.`,
              data: {
                conversationId: identity.conversationId,
                url: `/?chat=${identity.conversationId}`,
                category: 'arcade',
              },
            });
          } catch {
            console.warn(
              'Arcade invitation saved; notification delivery unavailable.',
            );
          }
        }
      } catch (error) {
        this.send(ws, {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unable to play.',
        });
        this.broadcast();
      }
    });
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.expire();
      this.broadcast();
    });
  }
  webSocketClose() {
    this.broadcast();
  }
  webSocketError(ws: WebSocket) {
    ws.close(1011, 'Reconnect to continue.');
  }
}
