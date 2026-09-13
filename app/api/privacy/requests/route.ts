import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';

const schema = z.object({ kind: z.enum(['export', 'delete']) });

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Choose export or delete.' }, { status: 400 });

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const existing = await db
      .prepare(
        "SELECT id, status FROM data_requests WHERE user_id = ? AND kind = ? AND status IN ('requested', 'processing') LIMIT 1",
      )
      .bind(user.id, parsed.data.kind)
      .first();
    if (existing) return json({ request: existing, duplicate: true });
    const now = Date.now();
    const id = identifier('dsr');
    await db
      .prepare(
        'INSERT INTO data_requests ' +
          '(id, user_id, kind, status, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        user.id,
        parsed.data.kind,
        'requested',
        now + 30 * 24 * 60 * 60 * 1000,
        now,
        now,
      )
      .run();
    return json({ request: { id, status: 'requested' } }, { status: 201 });
  });
}
