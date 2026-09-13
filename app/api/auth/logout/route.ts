import { expiredSessionCookie, revokeSession } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

export async function POST(request: Request) {
  return withDatabase(async () => {
    await revokeSession(request, getDb());
    return json(
      { ok: true },
      { headers: { 'set-cookie': expiredSessionCookie(request) } },
    );
  });
}
