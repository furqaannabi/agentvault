import type { Memory } from '@agentvault/memory';
import type { ExecResult, PolicyVerdict, Proof, TradeProposal } from '@agentvault/types';
import { type AnchorClient, makeAnchorClient } from './anchor.js';
import { assembleProof } from './assemble.js';
import { type ProofConfig, proofConfigFromEnv } from './config.js';

export type { ProofConfig } from './config.js';
export { canonicalize, computeRoot, hashCanonical, hashExec, hashProposal, hashVerdict } from './hash.js';

export interface ProofPipeline {
  assemble(input: {
    proposal: TradeProposal;
    verdict: PolicyVerdict;
    exec: ExecResult;
  }): Promise<Proof>;
  isAnchored(rootHash: `0x${string}`): Promise<boolean>;
}

export interface ProofDeps {
  memory: Memory;
  cfg?: ProofConfig;
  anchor?: AnchorClient;
}

export function createProofPipeline(deps: ProofDeps): ProofPipeline {
  const cfg = deps.cfg ?? proofConfigFromEnv();
  const anchor = deps.anchor ?? makeAnchorClient(cfg);
  return {
    assemble: (input) => assembleProof({ memory: deps.memory, anchor }, input),
    isAnchored: (root) => anchor.isAnchored(root),
  };
}
