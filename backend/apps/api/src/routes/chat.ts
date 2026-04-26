import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';
import type { SessionEnv } from '../middleware/session.js';

const Body = z.object({
  msg: z.string().min(1).max(4000),
});

export function chatRoute(deps: AppDeps) {
  const app = new Hono<SessionEnv>();
  app.post('/chat', async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad request', detail: parsed.error.format() }, 400);
    const session = c.get('session');
    try {
      const proposal = await deps.twin.handle(session.user.toLowerCase(), parsed.data.msg);
      return c.json({ proposal });
    } catch (e) {
      return c.json({ error: 'twin_failed', detail: (e as Error).message }, 500);
    }
  });
  return app;
}
