import { mockInference } from '@agentvault/mocks';
import type { Hex, RuleResult } from '@agentvault/types';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { signVerdict, verdictDigest } from '../src/sign.js';

const FIXED_KEY = '0x' + 'a'.repeat(64) as Hex;

const fields = {
  proposalId: 'prop_1',
  ok: true,
  rules: [
    { id: 'maxSize', pass: true } as RuleResult,
    { id: 'slippageCap', pass: true } as RuleResult,
  ],
  sanityInference: mockInference(),
  ts: 1_700_000_000_000,
};

describe('verdictDigest', () => {
  it('is deterministic for same input', () => {
    expect(verdictDigest(fields)).toBe(verdictDigest(fields));
  });
  it('changes when ok flips', () => {
    expect(verdictDigest({ ...fields, ok: false })).not.toBe(verdictDigest(fields));
  });
  it('changes when rules differ', () => {
    const flipped = {
      ...fields,
      rules: [
        { id: 'maxSize', pass: false } as RuleResult,
        ...fields.rules.slice(1),
      ],
    };
    expect(verdictDigest(flipped)).not.toBe(verdictDigest(fields));
  });
});

describe('signVerdict', () => {
  it('produces a recoverable ECDSA sig', async () => {
    const wallet = new ethers.Wallet(FIXED_KEY);
    const { sig, signer } = await signVerdict(wallet, fields);
    const digest = verdictDigest(fields);
    const recovered = ethers.verifyMessage(ethers.getBytes(digest), sig);
    expect(recovered.toLowerCase()).toBe(signer.toLowerCase());
    expect(recovered.toLowerCase()).toBe((await wallet.getAddress()).toLowerCase());
  });
});
