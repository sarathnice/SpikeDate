import app from '../dist/server/index.js';
import { handleArcade } from '../lib/server/arcade-room';
import { appendEnvironmentBanner } from '../lib/environment-banner';
export { ArcadeRoom } from '../lib/server/arcade-room';

// Dedicated local fixture environment. It has its own D1 and R2 storage.
const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || env.SPIKEDATE_LOCAL_PROFILE_DEMO !== 'true') {
      return new Response('Local preview only.', { status: 404 });
    }
    if (url.pathname === '/api/demo-info') {
      const profiles = await env.DB.prepare('SELECT COUNT(*) AS count FROM profiles').first();
      const photos = await env.DB.prepare('SELECT COUNT(*) AS count FROM profile_media').first();
      return Response.json({ mode: 'local-fictional-demo', profiles: profiles.count, photos: photos.count });
    }
    if (url.pathname === '/api/demo-logins') {
      // Only the loopback-only fixture worker exposes these disposable credentials.
      if (!env.SPIKEDATE_LOCAL_DEMO_PASSWORD) return new Response('Local credentials unavailable.', { status: 503 });
      const { results } = await env.DB.prepare("SELECT u.email, p.display_name AS name, p.gender FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id LIKE 'demo-v2-%' AND u.status = 'active' ORDER BY u.email").all();
      return Response.json({
        password: env.SPIKEDATE_LOCAL_DEMO_PASSWORD,
        accounts: results.map(({ email, name, gender }) => ({ email, profile: { name, gender } })),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/api/arcade/live') return handleArcade(request, env);
    const response = await app.fetch(request, env, ctx);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    const document = new Response(response.body, { status: response.status, headers });
    return appendEnvironmentBanner(document, env);
  }
};
export default worker;
