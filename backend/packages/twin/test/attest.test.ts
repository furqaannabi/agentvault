import type { Hex } from '@agentvault/types';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { attestInference, keccakUtf8 } from '../src/attest.js';

const FIXED_KEY = ('0x' + 'b'.repeat(64)) as Hex;

describe('keccakUtf8', () => {
  it('matches ethers.keccak256(utf8Bytes)', () => {
    const s = 'hello world';
    const expected = ethers.keccak256(new TextEncoder().encode(s));
    expect(keccakUtf8(s)).toBe(expected);
  });
});

describe('attestInference', () => {
  it('produces VerifiableInference with recoverable sig', async () => {
    const wallet = new ethers.Wallet(FIXED_KEY);
    const inf = await attestInference(wallet, {
      providerUrl: 'https://x.example/v1/proxy',
      modelId: 'm-1',
      prompt: 'p',
      output: 'o',
    });
    expect(inf.providerUrl).toBe('https://x.example/v1/proxy');
    expect(inf.modelId).toBe('m-1');
    expect(inf.promptHash).toBe(keccakUtf8('p'));
    expect(inf.outputHash).toBe(keccakUtf8('o'));
    expect(inf.signer.toLowerCase()).toBe((await wallet.getAddress()).toLowerCase());

    // recover from sig
    const digest = ethers.solidityPackedKeccak256(
      ['string', 'string', 'bytes32', 'bytes32', 'uint64'],
      [inf.providerUrl, inf.modelId, inf.promptHash, inf.outputHash, inf.ts],
    );
    const recovered = ethers.verifyMessage(ethers.getBytes(digest), inf.ourSig);
    expect(recovered.toLowerCase()).toBe(inf.signer.toLowerCase());
  });
});
