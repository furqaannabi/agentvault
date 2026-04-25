import type { ExecResult, Hex, PolicyVerdict, TradeProposal } from '@agentvault/types';
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
 * Root = keccak(h(proposal) ‖ h(verdict) ‖ h(exec)).
 * Simple 3-leaf hash chain — sufficient for P1 proof; extend to merkle in P2 if needed.
 */
export function computeRoot(p: TradeProposal, v: PolicyVerdict, e: ExecResult): Hex {
  const hp = hashProposal(p);
  const hv = hashVerdict(v);
  const he = hashExec(e);
  return ethers.solidityPackedKeccak256(['bytes32', 'bytes32', 'bytes32'], [hp, hv, he]) as Hex;
}
