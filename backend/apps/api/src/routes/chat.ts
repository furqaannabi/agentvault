import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';

const Body = z.object({
  userId: z.string().min(1),
  msg: z.string().min(1).max(4000),
});

export function chatRoute(deps: AppDeps) {
  const app = new Hono();
  app.post('/chat', async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad request', detail: parsed.error.format() }, 400);
    try {
      const proposal = await deps.twin.handle(parsed.data.userId, parsed.data.msg);
      return c.json({ proposal });
    } catch (e) {
      return c.json({ error: 'twin_failed', detail: (e as Error).message }, 500);
    }
  });
  return app;
}
