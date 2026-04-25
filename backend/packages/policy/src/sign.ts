import type { Hex, PolicyVerdict, RuleResult, VerifiableInference } from '@agentvault/types';
import { ethers } from 'ethers';

const enc = new TextEncoder();

function rulesDigest(rules: RuleResult[]): Hex {
  // Stable canonical encoding so verifier can reconstruct
  const canonical = rules
    .map((r) => `${r.id}:${r.pass ? '1' : '0'}:${r.detail ?? ''}`)
    .join('|');
  return ethers.keccak256(enc.encode(canonical)) as Hex;
}

function inferenceDigest(inf: VerifiableInference): Hex {
  return ethers.solidityPackedKeccak256(
    ['string', 'string', 'bytes32', 'bytes32', 'uint64', 'bytes', 'address'],
    [inf.providerUrl, inf.modelId, inf.promptHash, inf.outputHash, inf.ts, inf.ourSig, inf.signer],
  ) as Hex;
}

export function verdictDigest(input: {
  proposalId: string;
  ok: boolean;
  rules: RuleResult[];
  sanityInference: VerifiableInference;
  ts: number;
}): Hex {
  return ethers.solidityPackedKeccak256(
    ['string', 'bool', 'bytes32', 'bytes32', 'uint64'],
    [input.proposalId, input.ok, rulesDigest(input.rules), inferenceDigest(input.sanityInference), input.ts],
  ) as Hex;
}

export async function signVerdict(
  signer: ethers.Wallet,
  fields: {
    proposalId: string;
    ok: boolean;
    rules: RuleResult[];
    sanityInference: VerifiableInference;
    ts: number;
  },
): Promise<{ sig: Hex; signer: Hex }> {
  const digest = verdictDigest(fields);
  const sig = (await signer.signMessage(ethers.getBytes(digest))) as Hex;
  return { sig, signer: (await signer.getAddress()) as Hex };
}

export function buildVerdict(
  fields: {
    proposalId: string;
    ok: boolean;
    rules: RuleResult[];
    sanityInference: VerifiableInference;
    ts: number;
  },
  signed: { sig: Hex; signer: Hex },
): PolicyVerdict {
  return { ...fields, sig: signed.sig, signer: signed.signer };
}
