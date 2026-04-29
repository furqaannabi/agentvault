import { type PolicyContext, policyFromSession, sessionHash } from '@agentvault/policy';
import type { AgentSession, ExecStageEvent } from '@agentvault/types';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
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

/**
 * Item 4 demo path. Currently the only recognised flag is `force-retry`,
 * which under-estimates KeeperHub gas (`gasLimitMultiplier=0.85`) so the
 * first attempt out-of-gas-reverts and KeeperHub's retry policy lifts the
 * second attempt to success — surfaces real `attempts >= 2` in the audit
 * trail. Returns undefined for production paths.
 */
function parseDemoOverrides(query: string | undefined):
  | { gasLimitMultiplier?: string }
  | undefined {
  if (!query) return undefined;
  if (query === 'force-retry') return { gasLimitMultiplier: '0.85' };
  return undefined;
}

/**
 * Single-producer single-consumer async channel. The exec adapter calls
 * `push` synchronously during stage transitions; the SSE writer awaits
 * `next()` to drain. `close()` signals end-of-stream so `next()` returns
 * null after buffered events are flushed.
 */
class StageChannel {
  private resolvers: ((e: ExecStageEvent | null) => void)[] = [];
  private buffer: ExecStageEvent[] = [];
  private closed = false;

  push(event: ExecStageEvent): void {
    if (this.closed) return;
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(event);
    } else {
      this.buffer.push(event);
    }
  }

  close(): void {
    this.closed = true;
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(null);
    }
  }

  async next(): Promise<ExecStageEvent | null> {
    if (this.buffer.length > 0) return this.buffer.shift()!;
    if (this.closed) return null;
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }
}

export function approveRoute(deps: AppDeps) {
  const app = new Hono<SessionEnv>();
  app.post('/approve', async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad request' }, 400);

    const session = c.get('session');
    const signed = c.get('signed');
    const userId = session.user.toLowerCase();

    const proposal = await deps.memory.getProposal(userId, parsed.data.proposalId);
    if (!proposal) return c.json({ error: 'proposal_not_found' }, 404);

    const demoOverrides = parseDemoOverrides(c.req.query('demo'));
    const wantsSse = (c.req.header('accept') ?? '').toLowerCase().includes('text/event-stream');

    // ---- SSE branch (Item 10) ----
    if (wantsSse) {
      return streamSSE(c, async (stream) => {
        let seq = 0;
        const send = async (event: ExecStageEvent) => {
          await stream.writeSSE({
            id: String(seq++),
            event: event.stage.toLowerCase(),
            data: JSON.stringify(event),
          });
        };
        try {
          const verdict = await deps.policy.check(proposal, buildPolicyContext(session));
          await deps.memory.appendLog({ kind: 'agentvault.verdict.v1', verdict });
          await send({ stage: 'POLICY_CHECK', payload: { ok: verdict.ok } });
          if (!verdict.ok) {
            await send({ stage: 'FAILED', payload: { reason: 'verdict.ok=false', verdict } });
            return;
          }

          const channel = new StageChannel();
          const swapPromise = deps.exec
            .swap({
              proposal,
              verdict,
              user: session.user,
              demoOverrides,
              onStage: (e) => channel.push(e),
            })
            .finally(() => channel.close());

          // Drain stage events as they're produced by the adapter; resolves
          // `null` once the swap promise closes the channel.
          while (true) {
            const event = await channel.next();
            if (event === null) break;
            await send(event);
          }

          const exec = await swapPromise;
          if (exec.status !== 'success') {
            await send({
              stage: 'FAILED',
              payload: {
                error: exec.error ?? 'exec_failed',
                keeperhubAuditUrl: exec.keeperhub?.auditTrailUrl,
                lastRevertReason: exec.keeperhub?.error ?? exec.error ?? null,
              },
            });
            return;
          }

          const proof = await deps.proof.assemble({
            proposal,
            verdict,
            exec,
            session: { userAddr: session.user, sessionHash: sessionHash(signed) },
            keeperhubReceipts: exec.keeperhubReceipts,
          });
          // Final SETTLED event carries the full proof; FE swaps the strip
          // for the proof view on receipt.
          await send({ stage: 'SETTLED', payload: { proof } });
        } catch (e) {
          await send({ stage: 'FAILED', payload: { error: (e as Error).message } });
        }
      });
    }

    // ---- JSON branch (default) ----
    try {
      const verdict = await deps.policy.check(proposal, buildPolicyContext(session));
      await deps.memory.appendLog({ kind: 'agentvault.verdict.v1', verdict });

      if (!verdict.ok) {
        return c.json({ rejected: verdict });
      }

      const exec = await deps.exec.swap({
        proposal,
        verdict,
        user: session.user,
        demoOverrides,
      });
      if (exec.status !== 'success') {
        // Surface KeeperHub audit URL + last revert reason on failure (PRD FR-4)
        // so the verifier UI can link to KH's independent record even when the
        // trade did not settle.
        return c.json(
          {
            error: 'exec_failed',
            exec,
            verdict,
            ...(exec.keeperhub
              ? {
                  keeperhubAuditUrl: exec.keeperhub.auditTrailUrl,
                  lastRevertReason: exec.keeperhub.error ?? exec.error ?? null,
                }
              : {}),
          },
          502,
        );
      }

      const proof = await deps.proof.assemble({
        proposal,
        verdict,
        exec,
        session: { userAddr: session.user, sessionHash: sessionHash(signed) },
        keeperhubReceipts: exec.keeperhubReceipts,
      });
      return c.json({ proof });
    } catch (e) {
      return c.json({ error: 'approve_failed', detail: (e as Error).message }, 500);
    }
  });
  return app;
}
