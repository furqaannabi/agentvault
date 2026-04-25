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
  getProposal(id: string): Promise<TradeProposal | null>;
  setProposal(proposal: TradeProposal): Promise<void>;
  getProof(id: string): Promise<Proof | null>;
  setProof(proof: Proof): Promise<void>;
  // Log: immutable history
  appendLog<T>(entry: T): Promise<LogAppendResult>;
  readLog<T>(rootHash: string): Promise<T>;
}

export function createMemory(cfg: MemoryConfig = memoryConfigFromEnv()): Memory {
  const z: ZgClients = makeClients(cfg);
  const ks = z.cfg.streamState;
  const kp = z.cfg.streamProposal;
  return {
    getPortfolio: (userId) => kvGetJson<PortfolioState>(z, ks, `portfolio:${userId}`),
    setPortfolio: (s) => kvSetJson(z, ks, `portfolio:${s.userId}`, s),
    getConvo: (userId) => kvGetJson<ConvoState>(z, ks, `convo:${userId}`),
    setConvo: (s) => kvSetJson(z, ks, `convo:${s.userId}`, s),
    getProposal: (id) => kvGetJson<TradeProposal>(z, kp, `proposal:${id}`),
    setProposal: (p) => kvSetJson(z, kp, `proposal:${p.id}`, p),
    getProof: (id) => kvGetJson<Proof>(z, kp, `proof:${id}`),
    setProof: (p) => kvSetJson(z, kp, `proof:${p.proposalId}`, p),
    appendLog: (entry) => logAppend(z, entry),
    readLog: (rootHash) => logRead(z, rootHash),
  };
}
