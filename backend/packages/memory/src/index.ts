import { createHash } from 'node:crypto';
import type {
  ConvoState,
  PortfolioState,
  Proof,
  TradeProposal,
} from '@agentvault/types';
import { type ZgClients, makeClients } from './clients.js';
import { type MemoryConfig, memoryConfigFromEnv } from './config.js';
import { kvGetJson, kvSetJson } from './kv.js';
import { type LogAppendResult, logAppend, logRead } from './log.js';

export type { MemoryConfig } from './config.js';
export type { LogAppendResult } from './log.js';

export interface Memory {
  // KV: mutable state
  getPortfolio(userId: string): Promise<PortfolioState | null>;
  setPortfolio(state: PortfolioState): Promise<void>;
  getConvo(userId: string): Promise<ConvoState | null>;
  setConvo(state: ConvoState): Promise<void>;
  getProposal(user: string, id: string): Promise<TradeProposal | null>;
  setProposal(proposal: TradeProposal): Promise<void>;
  getProof(user: string, id: string): Promise<Proof | null>;
  getProofs(user: string): Promise<Proof[]>;
  setProof(proof: Proof): Promise<void>;
  // Log: immutable history
  appendLog<T>(entry: T): Promise<LogAppendResult>;
  readLog<T>(rootHash: string): Promise<T>;
}

/**
 * Wraps a 0G SDK call with a hard timeout + soft-fail.
 * Reads return null on timeout/error so the pipeline keeps flowing.
 * Writes log + swallow errors so a flaky KV doesn't kill a demo trade.
 */
async function softRead<T>(label: string, p: Promise<T>, ms = 8_000): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const v = await Promise.race([
      p,
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`[memory:${label}] timeout ${ms}ms`)), ms);
      }),
    ]);
    return v;
  } catch (e) {
    console.warn(`[memory:${label}] soft-fail:`, (e as Error).message);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function softWrite(label: string, p: Promise<unknown>, ms = 60_000): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      p,
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`[memory:${label}] timeout ${ms}ms`)), ms);
      }),
    ]);
  } catch (e) {
    console.warn(`[memory:${label}] soft-fail:`, (e as Error).message);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Single-wallet nonce serializer. 0G writes all originate from the same
 * ZG_PRIVATE_KEY signer, so concurrent in-flight txs collide at the mempool
 * with "replacement fee too low". Funnel every write factory through this
 * chain so nonces increment cleanly. Each enqueued task only runs after the
 * prior one fully settles (success or fail) — so the chain advance is tied
 * to the *actual* underlying work, not to the caller-facing softWrite
 * timeout. Otherwise a 60s caller timeout could resolve while the on-chain
 * tx is still pending, freeing the next factory to fire and collide nonces
 * again. Errors are swallowed so a flaky write doesn't block the queue.
 */
interface WriteQueue {
  /** Fire-and-forget: schedule a write, observe via softWrite timeout, swallow errors. */
  enqueue(label: string, factory: () => Promise<unknown>): void;
  /** Awaitable: schedule a write and return its result (or throw). Caller decides timeout. */
  enqueueAwaitable<T>(factory: () => Promise<T>): Promise<T>;
}

function makeWriteQueue(): WriteQueue {
  let tail: Promise<void> = Promise.resolve();
  function chain<T>(factory: () => Promise<T>, onErr: (e: Error) => void): Promise<T> {
    // Run factory only after prior settles. Chain advance is tied to the
    // *actual* underlying work, never to a caller-side timeout, otherwise a
    // 60s caller timeout could resolve while the on-chain tx is still pending,
    // freeing the next factory to fire and collide nonces again.
    const work = tail.then(() => factory());
    tail = work.then(
      () => {},
      (e: Error) => onErr(e),
    );
    return work;
  }
  return {
    enqueue(label, factory) {
      const work = chain(factory, (e) =>
        console.warn(`[memory:${label}] queued write error:`, e.message),
      );
      void softWrite(label, work);
    },
    enqueueAwaitable(factory) {
      // No swallow on chain — caller wants the real result/error.
      return chain(factory, () => {});
    },
  };
}

/**
 * In-memory cache + 0G KV passthrough.
 * Reads: cache first, fall back to KV (soft-fail to null).
 * Writes: update cache synchronously, fire KV write in background (soft-fail).
 *
 * Guarantees /chat → /approve → /proof works even if KV is flaky.
 * KV remains the source of truth across restarts when reachable.
 */
export function createMemory(cfg: MemoryConfig = memoryConfigFromEnv()): Memory {
  const z: ZgClients = makeClients(cfg);
  const ks = z.cfg.streamState;
  const kp = z.cfg.streamProposal;
  const kvEnabled = cfg.kvEnabled;

  if (!kvEnabled) {
    console.log('[memory] ZG_KV_ENABLED=false — running in-memory only (0g KV disabled)');
  } else {
    void z.provider
      .getBalance(z.signer.address)
      .then((bal) => {
        const min = 50_000_000_000_000_000n;
        if (bal < min) {
          console.warn(`[memory] wallet ${z.signer.address} balance ${bal} wei < 0.05 OG; refill via https://faucet.0g.ai`);
        } else {
          console.log(`[memory] wallet ${z.signer.address} balance ${bal} wei`);
        }
      })
      .catch((e) => console.warn('[memory] balance check failed:', (e as Error).message));
  }

  const portfolios = new Map<string, PortfolioState>();
  const convos = new Map<string, ConvoState>();
  const proposals = new Map<string, TradeProposal>();
  const proofs = new Map<string, Proof>();

  // Serialize all on-chain writes from the single ZG signer to avoid nonce
  // collisions (manifests as "replacement fee too low"). Reads are unaffected.
  const enqueue = makeWriteQueue();

  // All keys lowercased so an addr collision (mixed-case checksum) can't split state.
  const norm = (u: string) => u.toLowerCase();
  const proposalKey = (user: string, id: string) => `${norm(user)}:${id}`;
  const proofKey = (user: string, id: string) => `${norm(user)}:${id}`;

  return {
    async getPortfolio(userId) {
      const u = norm(userId);
      if (portfolios.has(u)) return portfolios.get(u)!;
      if (!kvEnabled) return null;
      const v = await softRead('getPortfolio', kvGetJson<PortfolioState>(z, ks, `portfolio:${u}`));
      if (v) portfolios.set(u, v);
      return v;
    },
    async setPortfolio(s) {
      const u = norm(s.userId);
      portfolios.set(u, s);
      if (kvEnabled) enqueue.enqueue('setPortfolio', () => kvSetJson(z, ks, `portfolio:${u}`, s));
    },
    async getConvo(userId) {
      const u = norm(userId);
      if (convos.has(u)) return convos.get(u)!;
      if (!kvEnabled) return null;
      const v = await softRead('getConvo', kvGetJson<ConvoState>(z, ks, `convo:${u}`));
      if (v) convos.set(u, v);
      return v;
    },
    async setConvo(s) {
      const u = norm(s.userId);
      convos.set(u, s);
      if (kvEnabled) enqueue.enqueue('setConvo', () => kvSetJson(z, ks, `convo:${u}`, s));
    },
    async getProposal(user, id) {
      const k = proposalKey(user, id);
      if (proposals.has(k)) return proposals.get(k)!;
      if (!kvEnabled) return null;
      const v = await softRead('getProposal', kvGetJson<TradeProposal>(z, kp, `proposal:${k}`));
      if (v) proposals.set(k, v);
      return v;
    },
    async setProposal(p) {
      const k = proposalKey(p.userId, p.id);
      proposals.set(k, p);
      if (kvEnabled) enqueue.enqueue('setProposal', () => kvSetJson(z, kp, `proposal:${k}`, p));
    },
    async getProof(user, id) {
      const k = proofKey(user, id);
      if (proofs.has(k)) return proofs.get(k)!;
      if (!kvEnabled) return null;
      const v = await softRead('getProof', kvGetJson<Proof>(z, kp, `proof:${k}`));
      if (v) proofs.set(k, v);
      return v;
    },
    async getProofs(user) {
      const u = norm(user);
      return [...proofs.entries()]
        .filter(([k]) => k.startsWith(`${u}:`))
        .map(([, v]) => v)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async setProof(p) {
      const k = proofKey(p.proposal.userId, p.proposalId);
      proofs.set(k, p);
      if (kvEnabled) enqueue.enqueue('setProof', () => kvSetJson(z, kp, `proof:${k}`, p));
    },
    async appendLog(entry) {
      const json = JSON.stringify(entry);
      const syntheticCid = `0x${createHash('sha256').update(json).digest('hex')}`;
      const syntheticResult = { rootHash: syntheticCid, txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as const };

      const ms = 60_000;
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          enqueue.enqueueAwaitable(() => logAppend(z, entry)),
          new Promise<never>((_, rej) => {
            timer = setTimeout(() => rej(new Error(`appendLog timeout ${ms}ms`)), ms);
          }),
        ]);
      } catch (e) {
        console.warn(
          `[memory:appendLog] soft-fail (using synthetic CID ${syntheticCid.slice(0, 18)}…):`,
          (e as Error).message.split('\n')[0],
        );
        return syntheticResult;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    readLog: (rootHash) => logRead(z, rootHash),
  };
}
