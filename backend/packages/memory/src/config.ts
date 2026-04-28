import type { Hex } from '@agentvault/types';

export interface MemoryConfig {
  rpcUrl: string;
  privateKey: Hex;
  indexerEndpoint: string;
  /** Optional fallback indexer (e.g. standard) used when primary (turbo) Flow.submit reverts. */
  indexerEndpointFallback?: string;
  kvReadEndpoint: string;
  flowContract: Hex;
  streamState: Hex;
  streamProposal: Hex;
  logNamespace: string;
  kvEnabled: boolean;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

export function memoryConfigFromEnv(): MemoryConfig {
  return {
    rpcUrl: req('ZG_RPC_URL'),
    privateKey: req('ZG_PRIVATE_KEY') as Hex,
    indexerEndpoint: req('ZG_INDEXER_ENDPOINT'),
    indexerEndpointFallback: process.env.ZG_INDEXER_ENDPOINT_FALLBACK || undefined,
    kvReadEndpoint: req('ZG_KV_READ_ENDPOINT'),
    flowContract: req('ZG_FLOW_CONTRACT') as Hex,
    streamState: req('ZG_KV_STREAM_STATE') as Hex,
    streamProposal: req('ZG_KV_STREAM_PROPOSAL') as Hex,
    logNamespace: process.env.ZG_LOG_NAMESPACE ?? 'agentvault',
    kvEnabled: process.env.ZG_KV_ENABLED === 'true',
  };
}
