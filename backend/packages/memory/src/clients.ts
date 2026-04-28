import { Indexer, KvClient } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import type { MemoryConfig } from './config.js';

export interface ZgClients {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
  indexer: Indexer;
  /** Optional standard indexer fallback when turbo Flow.submit reverts. */
  indexerFallback?: Indexer;
  kvRead: KvClient;
  cfg: MemoryConfig;
}

export function makeClients(cfg: MemoryConfig): ZgClients {
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const signer = new ethers.Wallet(cfg.privateKey, provider);
  const indexer = new Indexer(cfg.indexerEndpoint);
  const indexerFallback = cfg.indexerEndpointFallback
    ? new Indexer(cfg.indexerEndpointFallback)
    : undefined;
  const kvRead = new KvClient(cfg.kvReadEndpoint);
  return { provider, signer, indexer, indexerFallback, kvRead, cfg };
}
