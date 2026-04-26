import type { Memory } from '@agentvault/memory';
import type { ExecResult, Hex, PolicyVerdict, Proof, TradeProposal } from '@agentvault/types';
import type { AnchorClient } from './anchor.js';
import { computeRoot } from './hash.js';

export interface SessionBinding {
  userAddr: Hex;
  sessionHash: Hex;
}

export interface AssembleDeps {
  memory: Memory;
  anchor: AnchorClient;
}

/**
 * Pipeline:
 *  1. compute rootHash = keccak(h(proposal)||h(verdict)||h(exec))
 *  2. logAppend the full proof body → logCid (rootHash)
 *  3. anchorRoot(rootHash, logCid) on 0G Chain → anchorTx
 *  4. persist final Proof to KV (proof:<proposalId>)
 */
export async function assembleProof(
  deps: AssembleDeps,
  input: {
    proposal: TradeProposal;
    verdict: PolicyVerdict;
    exec: ExecResult;
    session: SessionBinding;
  },
): Promise<Proof> {
  const { proposal, verdict, exec, session } = input;
  const rootHash = computeRoot(proposal, verdict, exec);

  // Body persisted to immutable Log; logCid = the root hash returned by indexer
  const logBody = {
    kind: 'agentvault.proof.v1' as const,
    proposalId: proposal.id,
    userAddr: session.userAddr,
    sessionHash: session.sessionHash,
    proposal,
    verdict,
    exec,
    rootHash,
    createdAt: Date.now(),
  };
  const { rootHash: logCid } = await deps.memory.appendLog(logBody);

  // Anchor on 0G Chain
  const { txHash: anchorTx } = await deps.anchor.anchor(rootHash, logCid);

  const proof: Proof = {
    proposalId: proposal.id,
    userAddr: session.userAddr,
    sessionHash: session.sessionHash,
    proposal,
    verdict,
    exec,
    rootHash,
    anchorTx,
    anchorChainId: deps.anchor.cfg.chainId,
    logCid,
    createdAt: logBody.createdAt,
  };
  await deps.memory.setProof(proof);
  return proof;
}
