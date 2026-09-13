import { z } from 'zod';
import { createSession, verifyPassword } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import {
  emailSchema,
  passwordSchema,
  validationError,
} from '@/lib/server/validation';

export const runtime = 'edge';

const schema = z.object({ email: emailSchema, password: passwordSchema });

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      {
        error: 'Invalid email or password.',
        fields: validationError(parsed.error),
      },
      { status: 400 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const user = await db
      .prepare(
        'SELECT id, email, password_hash, status FROM users WHERE email = ? LIMIT 1',
      )
      .bind(parsed.data.email)
      .first<{
        id: string;
        email: string;
        password_hash: string | null;
        status: string;
      }>();
    const valid =
      user?.password_hash &&
      user.status === 'active' &&
      (await verifyPassword(parsed.data.password, user.password_hash));
    if (!user || !valid)
      return json({ error: 'Invalid email or password.' }, { status: 401 });
    const session = await createSession(db, user.id, request);
    return json(
      { user: { id: user.id, email: user.email } },
      { headers: { 'set-cookie': session.cookie } },
    );
  });
}
