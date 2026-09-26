import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { createSession, verifyPassword } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import { emailSchema, passwordSchema } from '@/lib/server/validation';

export const runtime = 'edge';

const credentials = z.object({ email: emailSchema, password: passwordSchema });

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return json({ error: 'Invalid administrator credentials.' }, { status: 401 });

  return withDatabase(async () => {
    const db = getDb();
    const user = await db
      .prepare('SELECT id, email, password_hash, status FROM users WHERE email = ? LIMIT 1')
      .bind(parsed.data.email)
      .first<{ id: string; email: string; password_hash: string | null; status: string }>();
    const valid = user?.password_hash && user.status === 'active' &&
      (await verifyPassword(parsed.data.password, user.password_hash));
    if (!user || !valid)
      return json({ error: 'Invalid administrator credentials.' }, { status: 401 });

    const roles = await db
      .prepare('SELECT role FROM admin_users WHERE user_id = ?')
      .bind(user.id)
      .all<{ role: string }>();
    if (!roles.results.length)
      return json({ error: 'Administrator access is not enabled for this account.' }, { status: 403 });
    if ((env as unknown as { SPIKEDATE_ADMIN_ACCESS_REQUIRED?: string }).SPIKEDATE_ADMIN_ACCESS_REQUIRED === 'true' &&
      request.headers.get('cf-access-authenticated-user-email')?.toLowerCase() !== user.email.toLowerCase())
      return json({ error: 'Cloudflare Access is required.' }, { status: 403 });

    const session = await createSession(db, user.id, request);
    return json(
      { admin: { email: user.email, roles: roles.results.map((row) => row.role) } },
      { headers: { 'set-cookie': session.cookie, 'cache-control': 'no-store' } },
    );
  });
}
