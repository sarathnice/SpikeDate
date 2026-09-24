import app from '../dist/server/index.js';
import { handleArcade } from '../lib/server/arcade-room';
export { ArcadeRoom } from '../lib/server/arcade-room';
const worker = {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/api/arcade/live')
      return handleArcade(request, env);
    const response = await app.fetch(request, env, ctx);
    // The native shell must revalidate the application document after a release.
    // Fingerprinted scripts and image assets retain their normal cache policy.
    if (response.headers.get('content-type')?.includes('text/html')) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store, max-age=0');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  },
};
export default worker;
