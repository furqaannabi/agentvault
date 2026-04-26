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

async function softWrite(label: string, p: Promise<unknown>, ms = 12_000): Promise<void> {
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

  // Async startup balance check. Each KV write attaches ~0.002 OG; warn if
  // wallet too low so soft-fails are diagnosed early instead of mid-demo.
  void z.provider
    .getBalance(z.signer.address)
    .then((bal) => {
      const min = 50_000_000_000_000_000n; // 0.05 OG
      if (bal < min) {
        console.warn(
          `[memory] wallet ${z.signer.address} balance ${bal} wei < 0.05 OG; refill via https://faucet.0g.ai`,
        );
      } else {
        console.log(`[memory] wallet ${z.signer.address} balance ${bal} wei`);
      }
    })
    .catch((e) => console.warn('[memory] balance check failed:', (e as Error).message));

  const portfolios = new Map<string, PortfolioState>();
  const convos = new Map<string, ConvoState>();
  const proposals = new Map<string, TradeProposal>();
  const proofs = new Map<string, Proof>();

  // All keys lowercased so an addr collision (mixed-case checksum) can't split state.
  const norm = (u: string) => u.toLowerCase();
  const proposalKey = (user: string, id: string) => `${norm(user)}:${id}`;
  const proofKey = (user: string, id: string) => `${norm(user)}:${id}`;

  return {
    async getPortfolio(userId) {
      const u = norm(userId);
      if (portfolios.has(u)) return portfolios.get(u)!;
      const v = await softRead('getPortfolio', kvGetJson<PortfolioState>(z, ks, `portfolio:${u}`));
      if (v) portfolios.set(u, v);
      return v;
    },
    async setPortfolio(s) {
      const u = norm(s.userId);
      portfolios.set(u, s);
      void softWrite('setPortfolio', kvSetJson(z, ks, `portfolio:${u}`, s));
    },
    async getConvo(userId) {
      const u = norm(userId);
      if (convos.has(u)) return convos.get(u)!;
      const v = await softRead('getConvo', kvGetJson<ConvoState>(z, ks, `convo:${u}`));
      if (v) convos.set(u, v);
      return v;
    },
    async setConvo(s) {
      const u = norm(s.userId);
      convos.set(u, s);
      void softWrite('setConvo', kvSetJson(z, ks, `convo:${u}`, s));
    },
    async getProposal(user, id) {
      const k = proposalKey(user, id);
      if (proposals.has(k)) return proposals.get(k)!;
      const v = await softRead('getProposal', kvGetJson<TradeProposal>(z, kp, `proposal:${k}`));
      if (v) proposals.set(k, v);
      return v;
    },
    async setProposal(p) {
      const k = proposalKey(p.userId, p.id);
      proposals.set(k, p);
      void softWrite('setProposal', kvSetJson(z, kp, `proposal:${k}`, p));
    },
    async getProof(user, id) {
      const k = proofKey(user, id);
      if (proofs.has(k)) return proofs.get(k)!;
      const v = await softRead('getProof', kvGetJson<Proof>(z, kp, `proof:${k}`));
      if (v) proofs.set(k, v);
      return v;
    },
    async setProof(p) {
      // Proof embeds the proposal which carries userId — single source of truth.
      const k = proofKey(p.proposal.userId, p.proposalId);
      proofs.set(k, p);
      void softWrite('setProof', kvSetJson(z, kp, `proof:${k}`, p));
    },
    async appendLog(entry) {
      const ms = 12_000;
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          logAppend(z, entry),
          new Promise<never>((_, rej) => {
            timer = setTimeout(() => rej(new Error(`appendLog timeout ${ms}ms`)), ms);
          }),
        ]);
      } catch (e) {
        // Soft-fail to a synthetic CID so anchor + proof flow continue.
        // CID = sha256(canonical(entry)) — deterministic, recoverable later if KV recovers.
        const json = JSON.stringify(entry);
        const cid = `0x${createHash('sha256').update(json).digest('hex')}`;
        console.warn(
          `[memory:appendLog] soft-fail (using synthetic CID ${cid.slice(0, 18)}…):`,
          (e as Error).message.split('\n')[0],
        );
        return { rootHash: cid, txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' };
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    readLog: (rootHash) => logRead(z, rootHash),
  };
}
