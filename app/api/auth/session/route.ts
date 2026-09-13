import { currentUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await currentUser(request, db);
    if (!user) return json({ user: null }, { status: 401 });
    const [profile, account] = await Promise.all([
      db
        .prepare(
          'SELECT display_name, verification_status, completed_at FROM profiles WHERE user_id = ?',
        )
        .bind(user.id)
        .first(),
      db
        .prepare('SELECT phone_verified_at FROM users WHERE id = ?')
        .bind(user.id)
        .first<{ phone_verified_at: number | null }>(),
    ]);
    return json({
      user: { ...user, phoneVerified: Boolean(account?.phone_verified_at) },
      profile,
    });
  });
}
