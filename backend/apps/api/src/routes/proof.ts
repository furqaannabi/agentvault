import { Hono } from 'hono';
import type { AppDeps } from '../deps.js';

export function proofRoute(deps: AppDeps) {
  const app = new Hono();

  app.get('/proof/:id', async (c) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'missing id' }, 400);
    const proof = await deps.memory.getProof(id);
    if (!proof) return c.json({ error: 'not_found' }, 404);
    return c.json({ proof });
  });

  return app;
}
