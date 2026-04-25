import type { Hex, VerifiableInference } from '@agentvault/types';
import { ethers } from 'ethers';

const enc = new TextEncoder();

export function keccakUtf8(s: string): Hex {
  return ethers.keccak256(enc.encode(s)) as Hex;
}

/**
 * Canonical message format the verifier reconstructs to check ourSig.
 * Order is fixed and ABI-encoded for unambiguous hashing.
 */
function attestationDigest(input: {
  providerUrl: string;
  modelId: string;
  promptHash: Hex;
  outputHash: Hex;
  ts: number;
}): Hex {
  const packed = ethers.solidityPackedKeccak256(
    ['string', 'string', 'bytes32', 'bytes32', 'uint64'],
    [input.providerUrl, input.modelId, input.promptHash, input.outputHash, input.ts],
  );
  return packed as Hex;
}

export async function attestInference(
  signer: ethers.Wallet,
  args: {
    providerUrl: string;
    modelId: string;
    prompt: string;
    output: string;
  },
): Promise<VerifiableInference> {
  const promptHash = keccakUtf8(args.prompt);
  const outputHash = keccakUtf8(args.output);
  const ts = Math.floor(Date.now() / 1000);
  const digest = attestationDigest({
    providerUrl: args.providerUrl,
    modelId: args.modelId,
    promptHash,
    outputHash,
    ts,
  });
  const ourSig = (await signer.signMessage(ethers.getBytes(digest))) as Hex;
  return {
    providerUrl: args.providerUrl,
    modelId: args.modelId,
    promptHash,
    outputHash,
    ts,
    ourSig,
    signer: (await signer.getAddress()) as Hex,
  };
}
