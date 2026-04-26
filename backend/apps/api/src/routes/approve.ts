import { type PolicyContext, policyFromSession } from '@agentvault/policy';
import type { AgentSession } from '@agentvault/types';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';
import type { SessionEnv } from '../middleware/session.js';

const Body = z.object({
  proposalId: z.string().min(1),
});

/**
 * P1 simplification: lastTradeAt + todayVolume tracking deferred to P2.
 * Cooldown + dailyCap rules will pass trivially until ledger is wired.
 */
function buildPolicyContext(session: AgentSession): PolicyContext {
  const cfg = policyFromSession(session);
  return {
    whitelist: cfg.whitelist,
    maxAmountIn: cfg.maxAmountIn,
    maxSlippageBps: cfg.maxSlippageBps,
    todayVolume: 0n,
    dailyCap: cfg.dailyCap,
    lastTradeAt: null,
    cooldownMs: cfg.cooldownMs,
  };
}

export function approveRoute(deps: AppDeps) {
  const app = new Hono<SessionEnv>();
  app.post('/approve', async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad request' }, 400);

    const session = c.get('session');
    const userId = session.user.toLowerCase();

    const proposal = await deps.memory.getProposal(userId, parsed.data.proposalId);
    if (!proposal) return c.json({ error: 'proposal_not_found' }, 404);

    try {
      const verdict = await deps.policy.check(proposal, buildPolicyContext(session));
      await deps.memory.appendLog({ kind: 'agentvault.verdict.v1', verdict });

      if (!verdict.ok) {
        return c.json({ rejected: verdict });
      }

      const exec = await deps.exec.swap({ proposal, verdict, user: session.user });
      if (exec.status !== 'success') {
        return c.json({ error: 'exec_failed', exec, verdict }, 502);
      }

      const proof = await deps.proof.assemble({ proposal, verdict, exec });
      return c.json({ proof });
    } catch (e) {
      return c.json({ error: 'approve_failed', detail: (e as Error).message }, 500);
    }
  });
  return app;
}
