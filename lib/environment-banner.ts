import type { D1DatabaseLike } from './server/db';

export const bannerLabels = ['Local demo', 'Local preview', 'Staging', 'Test environment'] as const;
export type BannerLabel = (typeof bannerLabels)[number];
export type BannerEnvironment = 'local' | 'staging';
export type BannerEnv = { DB?: D1DatabaseLike; SPIKEDATE_LOCAL_PROFILE_DEMO?: string; SPIKEDATE_FICTIONAL_PROFILES?: string };
export function bannerEnvironment(env: BannerEnv): BannerEnvironment | null {
  if (env.SPIKEDATE_LOCAL_PROFILE_DEMO === 'true') return 'local';
  if (env.SPIKEDATE_FICTIONAL_PROFILES === 'true') return 'staging';
  return null;
}
export function bannerText(label: BannerLabel) { return `${label} · fictional profiles`; }
export type BannerSetting = { label: BannerLabel; version: number; updatedAt: number | null };
export async function readBanner(db: D1DatabaseLike, environment: BannerEnvironment): Promise<BannerSetting> {
  const row = await db.prepare('SELECT label, version, updated_at FROM environment_banners WHERE environment = ?').bind(environment).first<{ label: string; version: number; updated_at: number }>();
  return { label: row && bannerLabels.includes(row.label as BannerLabel) ? row.label as BannerLabel : environment === 'local' ? 'Local demo' : 'Test environment', version: row?.version ?? 0, updatedAt: row?.updated_at ?? null };
}
export async function appendEnvironmentBanner(response: Response, env: BannerEnv): Promise<Response> {
  const environment = bannerEnvironment(env);
  if (!environment) return response;
  let label: BannerLabel = environment === 'local' ? 'Local demo' : 'Test environment';
  try { if (env.DB) label = (await readBanner(env.DB, environment)).label; }
  catch (error) {
    // Old deployments may not have the settings migration yet. Never remove
    // the disclosure, or make the member app unavailable, on a settings failure.
    console.warn('Environment banner default used:', error instanceof Error ? error.message : 'settings unavailable');
  }
  const marker = environment === 'local' ? 'data-local-demo' : 'data-stage-fictional';
  return new HTMLRewriter().on('body', {
    element(element) {
      element.append(`<aside data-environment-banner="${environment}" ${marker}="true" role="note" style="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:2147483647;padding:2px 10px;border-radius:0 0 7px 7px;background:#392218;color:#fff1e8;font:10px/14px system-ui;white-space:nowrap;pointer-events:none">${bannerText(label)}</aside>`, { html: true });
    },
  }).transform(response);
}
