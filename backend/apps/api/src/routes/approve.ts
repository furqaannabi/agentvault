import { DEFAULT_POLICY, type PolicyContext } from '@agentvault/policy';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';

const Body = z.object({
  proposalId: z.string().min(1),
  // Bridge until session middleware lands (commit 6); FE passes user addr.
  userId: z.string().min(1),
});

/**
 * P1 simplification: lastTradeAt + todayVolume tracking deferred to P2.
 * Cooldown + dailyCap rules will pass trivially until ledger is wired.
 */
function buildPolicyContext(): PolicyContext {
  return {
    whitelist: DEFAULT_POLICY.whitelist,
    maxAmountIn: DEFAULT_POLICY.maxAmountIn,
    maxSlippageBps: DEFAULT_POLICY.maxSlippageBps,
    todayVolume: 0n,
    dailyCap: DEFAULT_POLICY.dailyCap,
    lastTradeAt: null,
    cooldownMs: DEFAULT_POLICY.cooldownMs,
  };
}

export function approveRoute(deps: AppDeps) {
  const app = new Hono();
  app.post('/approve', async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad request' }, 400);

    const proposal = await deps.memory.getProposal(parsed.data.userId, parsed.data.proposalId);
    if (!proposal) return c.json({ error: 'proposal_not_found' }, 404);

    try {
      const verdict = await deps.policy.check(proposal, buildPolicyContext());
      await deps.memory.appendLog({ kind: 'agentvault.verdict.v1', verdict });

      if (!verdict.ok) {
        return c.json({ rejected: verdict });
      }

      const exec = await deps.exec.swap({
        proposal,
        verdict,
        user: parsed.data.userId as `0x${string}`,
      });
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
