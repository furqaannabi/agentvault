import type {
  ExecResult,
  Hex,
  KeeperhubExecution,
  PolicyVerdict,
  TradeProposal,
} from '@agentvault/types';
import { ethers } from 'ethers';

const enc = new TextEncoder();

/**
 * Stable JSON: keys sorted at every depth so hash is reproducible across
 * languages and serializers. BigInt converted upstream — input must be JSON-safe.
 */
export function canonicalize(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    const o = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) sorted[k] = sortKeys(o[k]);
    return sorted;
  };
  return JSON.stringify(sortKeys(value));
}

export function hashCanonical(value: unknown): Hex {
  return ethers.keccak256(enc.encode(canonicalize(value))) as Hex;
}

export function hashProposal(p: TradeProposal): Hex {
  return hashCanonical(p);
}

export function hashVerdict(v: PolicyVerdict): Hex {
  return hashCanonical(v);
}

export function hashExec(e: ExecResult): Hex {
  return hashCanonical(e);
}

/**
 * Hash of the keeperhub-receipts leaf. Order is significant — receipts are
 * intentionally hashed as a positional array so swapping approval/swap
 * positions produces a different hash. Empty/absent inputs hash to a stable
 * value (`hashCanonical([])`) so non-keeperhub modes share a deterministic
 * 4-leaf rootHash without special-casing branches.
 */
export function hashKeeperhub(receipts?: readonly KeeperhubExecution[]): Hex {
  return hashCanonical(receipts ?? []);
}

/**
 * Root = keccak(h(proposal) ‖ h(verdict) ‖ h(exec) ‖ h(keeperhubReceipts)).
 * 4-leaf hash chain — sufficient for P1 proof; extend to merkle in P2 if needed.
 *
 * The keeperhub leaf is always included even when `receipts` is empty so all
 * proofs share the same shape.
 */
export function computeRoot(
  p: TradeProposal,
  v: PolicyVerdict,
  e: ExecResult,
  receipts?: readonly KeeperhubExecution[],
): Hex {
  const hp = hashProposal(p);
  const hv = hashVerdict(v);
  const he = hashExec(e);
  const hk = hashKeeperhub(receipts);
  return ethers.solidityPackedKeccak256(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [hp, hv, he, hk],
  ) as Hex;
}
