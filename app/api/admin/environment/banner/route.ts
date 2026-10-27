import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { bannerEnvironment, bannerLabels, bannerText, readBanner, type BannerEnv } from '@/lib/environment-banner';

export const runtime = 'edge';
const schema = z.object({ label: z.enum(bannerLabels), reason: z.string().trim().min(10).max(500), expectedVersion: z.number().int().min(0) }).strict();
const headers = { 'cache-control': 'no-store' };

export async function GET(request: Request) {
  return withDatabase(async db => {
    const admin = await requireAdmin(request, db, ['super_admin']);
    if (admin instanceof Response) return admin;
    const environment = bannerEnvironment(env as unknown as BannerEnv);
    if (!environment) return json({ error: 'Banner controls are available only in fictional-profile test environments.' }, { status: 409, headers });
    const [setting, count] = await Promise.all([readBanner(db, environment), db.prepare('SELECT COUNT(*) AS count FROM profiles').first<{ count: number }>()]);
    return json({ environment, ...setting, text: bannerText(setting.label), labels: bannerLabels, affectedProfiles: count?.count ?? 0, scope: 'environment', refresh: 'next page load' }, { headers });
  });
}

export async function PATCH(request: Request) {
  // Consume the small JSON payload before an early denial. The local worker
  // proxy otherwise leaves a pooled socket unusable for the next POST.
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Cross-origin changes are not allowed.' }, { status: 403, headers });
  return withDatabase(async db => {
    const admin = await requireAdmin(request, db, ['super_admin']);
    if (admin instanceof Response) return admin;
    const environment = bannerEnvironment(env as unknown as BannerEnv);
    if (!environment) return json({ error: 'This is not a fictional-profile test environment.' }, { status: 409, headers });
    const parsed = schema.safeParse(input);
    if (!parsed.success) return json({ error: 'Choose an approved label, keep the disclosure, and provide a reason of 10–500 characters.' }, { status: 400, headers });
    const before = await readBanner(db, environment);
    if (before.version !== parsed.data.expectedVersion) return json({ error: 'The banner changed in another session. Reload the current setting and review again.' }, { status: 409, headers });
    if (before.label === parsed.data.label) return json({ ok: true, unchanged: true, ...before, text: bannerText(before.label) }, { headers });
    const count = await db.prepare('SELECT COUNT(*) AS count FROM profiles').first<{ count: number }>();
    const now = Date.now(), changeId = identifier('banner'), nextVersion = before.version + 1;
    const after = { environment, label: parsed.data.label, version: nextVersion, reason: parsed.data.reason, affectedProfiles: count?.count ?? 0 };
    const result = await db.batch([
      db.prepare('INSERT INTO environment_banners (environment,label,version,updated_by,updated_at,change_id) VALUES (?,?,?,?,?,?) ON CONFLICT(environment) DO UPDATE SET label=excluded.label,version=environment_banners.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at,change_id=excluded.change_id WHERE environment_banners.version = ?')
        .bind(environment, parsed.data.label, nextVersion, admin.user.id, now, changeId, before.version),
      db.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? FROM environment_banners WHERE environment=? AND change_id=?')
        .bind(identifier('aud'), admin.user.id, 'admin.environment.banner.update', 'environment', environment, JSON.stringify(before), JSON.stringify(after), now, environment, changeId),
    ]);
    if (Number(result[0]?.meta.changes ?? 0) !== 1) return json({ error: 'A concurrent update was saved first. Reload and review again.' }, { status: 409, headers });
    return json({ ok: true, environment, label: parsed.data.label, text: bannerText(parsed.data.label), version: nextVersion, updatedAt: now, affectedProfiles: count?.count ?? 0 }, { headers });
  });
}
