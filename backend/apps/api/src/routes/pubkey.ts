import { Hono } from 'hono';
import type { AppDeps } from '../deps.js';

export function pubkeyRoute(deps: AppDeps) {
  const app = new Hono();
  app.get('/pubkey', async (c) => {
    const signer = await deps.policy.signerAddress();
    return c.json({ signer });
  });
  return app;
}
