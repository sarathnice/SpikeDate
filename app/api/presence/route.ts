import { z } from 'zod';
import { currentUser, requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import { isRecentlyActive, ONLINE_TTL_MS } from '@/lib/presence';

export const runtime = 'edge';
const clientSchema = z.object({ clientId: z.string().uuid() });

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await currentUser(request, db);
    if (!user) return json({ error: 'Sign in required.' }, { status: 401 });
    const rawIds = new URL(request.url).searchParams.get('ids');
    if (rawIds === null) {
      const preference = await db
        .prepare(
          'SELECT show_online FROM presence_preferences WHERE user_id = ?',
        )
        .bind(user.id)
        .first<{ show_online: number }>();
      return json({ showOnline: preference?.show_online !== 0 });
    }
    const ids = [...new Set(rawIds.split(',').filter(Boolean))];
    if (ids.length > 50 || ids.some((id) => id.length > 100))
      return json({ error: 'Request up to 50 profiles.' }, { status: 400 });
    if (!ids.length) return json({ presence: [] });
    const now = Date.now();
    const rows = await db
      .prepare(
        'SELECT users.id, users.last_active_at, pref.show_online, ' +
          '(SELECT MAX(live.last_seen_at) FROM live_presence live JOIN sessions ON sessions.id = live.session_id ' +
          'WHERE sessions.user_id = users.id AND sessions.revoked_at IS NULL AND sessions.expires_at > ?) AS last_seen_at ' +
          'FROM users JOIN profiles ON profiles.user_id = users.id ' +
          'LEFT JOIN presence_preferences pref ON pref.user_id = users.id ' +
          `WHERE users.id IN (${ids.map(() => '?').join(',')}) AND users.status = 'active' ` +
          'AND (profiles.discoverable = 1 OR users.id = ? OR EXISTS ' +
          "(SELECT 1 FROM matches WHERE status = 'active' AND " +
          '((user_a_id = ? AND user_b_id = users.id) OR (user_b_id = ? AND user_a_id = users.id)))) ' +
          "AND NOT EXISTS (SELECT 1 FROM safety_actions WHERE kind = 'block' AND " +
          '((reporter_id = ? AND subject_id = users.id) OR (subject_id = ? AND reporter_id = users.id)))',
      )
      .bind(now, ...ids, user.id, user.id, user.id, user.id, user.id)
      .all<{
        id: string;
        last_active_at: number | null;
        last_seen_at: number | null;
        show_online: number | null;
      }>();
    return json({
      presence: ids.map((id) => {
        const row = rows.results.find((item) => item.id === id);
        if (!row || row.show_online === 0)
          return { id, state: 'hidden', onlineUntil: null, lastActiveAt: null };
        const onlineUntil = row.last_seen_at
          ? row.last_seen_at + ONLINE_TTL_MS
          : null;
        return {
          id,
          state:
            onlineUntil && onlineUntil > now
              ? 'online'
              : isRecentlyActive(row.last_active_at, now)
                ? 'recent'
                : 'offline',
          onlineUntil: onlineUntil && onlineUntil > now ? onlineUntil : null,
          lastActiveAt: row.last_active_at,
        };
      }),
    });
  });
}

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Invalid presence client.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    await db
      .prepare(
        'INSERT INTO live_presence (session_id, client_id, last_seen_at) ' +
          'SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM presence_preferences WHERE user_id = ? AND show_online = 0) ' +
          'ON CONFLICT(session_id, client_id) DO UPDATE SET last_seen_at = excluded.last_seen_at ' +
          'WHERE live_presence.last_seen_at < ?',
      )
      .bind(user.sessionId, parsed.data.clientId, now, user.id, now - 15_000)
      .run();
    return json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Invalid presence client.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const user = await currentUser(request, db);
    if (!user) return json({ error: 'Sign in required.' }, { status: 401 });
    await db
      .prepare(
        'DELETE FROM live_presence WHERE session_id = ? AND client_id = ?',
      )
      .bind(user.sessionId, parsed.data.clientId)
      .run();
    return json({ ok: true });
  });
}

export async function PATCH(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = z.object({ showOnline: z.boolean() }).safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Choose whether to show online status.' },
      { status: 400 },
    );
  return withDatabase(async () => {
    const db = getDb();
    const user = await currentUser(request, db);
    if (!user) return json({ error: 'Sign in required.' }, { status: 401 });
    const statements = [
      db
        .prepare(
          'INSERT INTO presence_preferences (user_id, show_online) VALUES (?, ?) ' +
            'ON CONFLICT(user_id) DO UPDATE SET show_online = excluded.show_online',
        )
        .bind(user.id, Number(parsed.data.showOnline)),
    ];
    if (!parsed.data.showOnline)
      statements.push(
        db
          .prepare(
            'DELETE FROM live_presence WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)',
          )
          .bind(user.id),
      );
    await db.batch(statements);
    return json({ showOnline: parsed.data.showOnline });
  });
}
