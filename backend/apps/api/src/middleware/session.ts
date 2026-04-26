import { SessionError, verifySession } from '@agentvault/policy';
import type { AgentSession, Hex, SignedSession } from '@agentvault/types';
import type { Context, MiddlewareHandler } from 'hono';

export type SessionEnv = {
  Variables: {
    session: AgentSession;
    signed: SignedSession;
  };
};

export interface SessionMiddlewareConfig {
  delegate: Hex;
  chainId: number;
}

export interface SessionStore {
  middleware: MiddlewareHandler;
  revoke(nonce: Hex): void;
  isRevoked(nonce: Hex): boolean;
}

const HEADER_PREFIX = 'Session ';

function parseHeader(c: Context): SignedSession | null {
  const auth = c.req.header('authorization');
  if (!auth || !auth.startsWith(HEADER_PREFIX)) return null;
  const b64 = auth.slice(HEADER_PREFIX.length).trim();
  try {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const obj = JSON.parse(json) as SignedSession;
    if (!obj?.session || !obj.signature) return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * Hono middleware that authenticates requests via an EIP-712 SignedSession in
 * `Authorization: Session <base64(SignedSession)>`. On success, sets:
 *   c.get('session')  → AgentSession
 *   c.get('signed')   → SignedSession (full envelope, used by proof for sessionHash)
 */
export function createSessionStore(cfg: SessionMiddlewareConfig): SessionStore {
  const revoked = new Set<Hex>();

  const middleware: MiddlewareHandler = async (c, next) => {
    const signed = parseHeader(c);
    if (!signed) {
      return c.json({ error: 'missing_or_malformed_session' }, 401);
    }
    try {
      verifySession(signed, {
        delegate: cfg.delegate,
        chainId: cfg.chainId,
        isRevoked: (n) => revoked.has(n),
      });
    } catch (e) {
      const code = e instanceof SessionError ? e.code : 'invalid_session';
      return c.json({ error: code, detail: (e as Error).message }, 401);
    }
    c.set('session', signed.session satisfies AgentSession);
    c.set('signed', signed);
    await next();
  };

  return {
    middleware,
    revoke: (nonce) => revoked.add(nonce),
    isRevoked: (nonce) => revoked.has(nonce),
  };
}
