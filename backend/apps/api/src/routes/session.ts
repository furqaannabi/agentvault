import { Hono } from 'hono';
import type { SessionEnv, SessionStore } from '../middleware/session.js';

/**
 * Routes for session lifecycle. Both endpoints sit behind the session
 * middleware, so by the time the handler runs we already know the session
 * verifies. /validate is FE's "did my sig + bounds check out?" probe; DELETE
 * marks the nonce revoked so subsequent requests with the same sig 401.
 */
export function sessionRoute(store: SessionStore) {
  const app = new Hono<SessionEnv>();

  app.post('/session/validate', (c) => {
    const session = c.get('session');
    return c.json({
      ok: true,
      user: session.user,
      delegate: session.delegate,
      expiresAt: session.expiresAt,
      nonce: session.nonce,
    });
  });

  app.delete('/session', (c) => {
    const session = c.get('session');
    store.revoke(session.nonce);
    return c.json({ ok: true, revoked: session.nonce });
  });

  return app;
}
