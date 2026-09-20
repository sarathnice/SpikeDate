import app from '../dist/server/index.js';
import { handleArcade } from '../lib/server/arcade-room';
export { ArcadeRoom } from '../lib/server/arcade-room';
const worker = {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/api/arcade/live')
      return handleArcade(request, env);
    return app.fetch(request, env, ctx);
  },
};
export default worker;
