import { Hono } from 'hono';
import type { AppDeps } from '../deps.js';
import type { SessionEnv } from '../middleware/session.js';

export function proofRoute(deps: AppDeps) {
  const app = new Hono<SessionEnv>();

  app.get('/proof/:id', async (c) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'missing id' }, 400);
    const session = c.get('session');
    const proof = await deps.memory.getProof(session.user.toLowerCase(), id);
    if (!proof) return c.json({ error: 'not_found' }, 404);
    return c.json({ proof });
  });

  return app;
}
