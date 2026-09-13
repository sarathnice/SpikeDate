import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';

const schema = z.object({
  text: z.string().trim().min(2).max(280),
  visibility: z.enum(['discover', 'liked', 'matches']),
  availableTonight: z.boolean().default(false),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Write a daily update up to 280 characters.' },
      { status: 400 },
    );
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const existing = await db
      .prepare(
        'SELECT id FROM daily_updates WHERE user_id = ? AND expires_at > ? AND deleted_at IS NULL LIMIT 1',
      )
      .bind(user.id, now)
      .first<{ id: string }>();
    if (existing) {
      await db
        .prepare(
          'UPDATE daily_updates SET text = ?, visibility = ?, available_tonight = ?, expires_at = ?, updated_at = ? WHERE id = ?',
        )
        .bind(
          parsed.data.text,
          parsed.data.visibility,
          parsed.data.availableTonight ? 1 : 0,
          expiresAt,
          now,
          existing.id,
        )
        .run();
      return json({ update: { id: existing.id, expiresAt }, replaced: true });
    }
    const id = identifier('upd');
    await db
      .prepare(
        'INSERT INTO daily_updates ' +
          '(id, user_id, text, visibility, available_tonight, expires_at, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        user.id,
        parsed.data.text,
        parsed.data.visibility,
        parsed.data.availableTonight ? 1 : 0,
        expiresAt,
        now,
        now,
      )
      .run();
    return json({ update: { id, expiresAt } }, { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    await db
      .prepare(
        'UPDATE daily_updates SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND expires_at > ? AND deleted_at IS NULL',
      )
      .bind(now, now, user.id, now)
      .run();
    return json({ ok: true });
  });
}
