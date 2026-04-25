import type { Hex } from '@agentvault/types';

export interface ProofConfig {
  rpcUrl: string;
  privateKey: Hex;
  proofAnchorAddress: Hex;
  chainId: number;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

export function proofConfigFromEnv(): ProofConfig {
  return {
    rpcUrl: req('ZG_RPC_URL'),
    privateKey: req('ZG_PRIVATE_KEY') as Hex,
    proofAnchorAddress: req('PROOF_ANCHOR_ADDRESS') as Hex,
    chainId: Number(process.env.ZG_CHAIN_ID ?? 16602),
  };
}
