import { Indexer, KvClient } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import type { MemoryConfig } from './config.js';

export interface ZgClients {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
  indexer: Indexer;
  kvRead: KvClient;
  cfg: MemoryConfig;
}

export function makeClients(cfg: MemoryConfig): ZgClients {
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const signer = new ethers.Wallet(cfg.privateKey, provider);
  const indexer = new Indexer(cfg.indexerEndpoint);
  const kvRead = new KvClient(cfg.kvReadEndpoint);
  return { provider, signer, indexer, kvRead, cfg };
}
