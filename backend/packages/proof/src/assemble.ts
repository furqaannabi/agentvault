import type { Memory } from '@agentvault/memory';
import type {
  ExecResult,
  Hex,
  KeeperhubExecution,
  PolicyVerdict,
  Proof,
  TradeProposal,
} from '@agentvault/types';
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
 *  1. compute rootHash = keccak(h(proposal)||h(verdict)||h(exec)||h(keeperhubReceipts))
 *  2. logAppend the full proof body → logCid (rootHash)
 *  3. anchorRoot(rootHash, logCid) on 0G Chain → anchorTx
 *  4. persist final Proof to KV (proof:<proposalId>)
 *
 * `keeperhubReceipts` is the canonical home for KH execution data; it forms
 * the 4th leaf of rootHash. The route layer extracts receipts from
 * ExecResult.keeperhubReceipts (transient) and forwards them here.
 */
export async function assembleProof(
  deps: AssembleDeps,
  input: {
    proposal: TradeProposal;
    verdict: PolicyVerdict;
    exec: ExecResult;
    session: SessionBinding;
    keeperhubReceipts?: readonly KeeperhubExecution[];
  },
): Promise<Proof> {
  const { proposal, verdict, exec, session, keeperhubReceipts } = input;

  // Strip the transient carrier off ExecResult before persisting — the
  // canonical home for receipts is Proof.keeperhubReceipts (top-level).
  // We keep the back-compat ExecResult.keeperhub (singular swap entry) intact
  // so existing FE readers don't break.
  const persistedExec: ExecResult = { ...exec };
  delete persistedExec.keeperhubReceipts;

  const receipts = keeperhubReceipts ?? exec.keeperhubReceipts;
  const rootHash = computeRoot(proposal, verdict, persistedExec, receipts);

  const logBody = {
    kind: 'agentvault.proof.v1' as const,
    proposalId: proposal.id,
    userAddr: session.userAddr,
    sessionHash: session.sessionHash,
    proposal,
    verdict,
    exec: persistedExec,
    keeperhubReceipts: receipts,
    rootHash,
    createdAt: Date.now(),
  };
  const { rootHash: logCid } = await deps.memory.appendLog(logBody);

  const { txHash: anchorTx } = await deps.anchor.anchor(rootHash, logCid);

  const proof: Proof = {
    proposalId: proposal.id,
    userAddr: session.userAddr,
    sessionHash: session.sessionHash,
    proposal,
    verdict,
    exec: persistedExec,
    ...(receipts && receipts.length > 0
      ? { keeperhubReceipts: [...receipts] as KeeperhubExecution[] }
      : {}),
    rootHash,
    anchorTx,
    anchorChainId: deps.anchor.cfg.chainId,
    logCid,
    createdAt: logBody.createdAt,
  };
  await deps.memory.setProof(proof);
  return proof;
}
