import type { D1DatabaseLike } from './db';
import { requireUser } from './auth';
import { json } from './http';

export const adminRoles = [
  'super_admin',
  'safety_reviewer',
  'moderator',
  'support_agent',
  'billing_analyst',
  'read_only_analyst',
] as const;

export type AdminRole = (typeof adminRoles)[number];

export async function requireAdmin(
  request: Request,
  db: D1DatabaseLike,
  allowed: readonly AdminRole[] = adminRoles,
) {
  const user = await requireUser(request, db);
  if (user instanceof Response) return user;
  if (process.env.SPIKEDATE_ADMIN_ACCESS_REQUIRED === 'true') {
    const accessEmail = request.headers
      .get('cf-access-authenticated-user-email')
      ?.toLowerCase();
    if (!accessEmail || accessEmail !== user.email.toLowerCase())
      return json({ error: 'Cloudflare Access is required.' }, { status: 403 });
  }
  const result = await db
    .prepare('SELECT role FROM admin_users WHERE user_id = ?')
    .bind(user.id)
    .all<{ role: AdminRole }>();
  const roles = result.results.map((row) => row.role);
  if (!roles.some((role) => allowed.includes(role)))
    return json({ error: 'Administrator access required.' }, { status: 403 });
  return { user, roles };
}
