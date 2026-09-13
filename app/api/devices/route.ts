import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
const schema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  token: z.string().trim().min(20).max(4096),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Device registration is invalid.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    const existing = await db
      .prepare('SELECT id FROM device_tokens WHERE token = ? LIMIT 1')
      .bind(parsed.data.token)
      .first<{ id: string }>();
    if (existing) {
      await db
        .prepare(
          'UPDATE device_tokens SET user_id = ?, platform = ?, active = 1, last_seen_at = ?, updated_at = ? WHERE id = ?',
        )
        .bind(user.id, parsed.data.platform, now, now, existing.id)
        .run();
      return json({ device: { id: existing.id } });
    }
    const id = identifier('dev');
    await db
      .prepare(
        'INSERT INTO device_tokens ' +
          '(id, user_id, platform, token, active, last_seen_at, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        user.id,
        parsed.data.platform,
        parsed.data.token,
        1,
        now,
        now,
        now,
      )
      .run();
    return json({ device: { id } }, { status: 201 });
  });
}
