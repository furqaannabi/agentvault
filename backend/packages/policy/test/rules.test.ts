import { mockProposal } from '@agentvault/mocks';
import type { Hex } from '@agentvault/types';
import { describe, expect, it } from 'vitest';
import {
  cooldown,
  dailyCap,
  maxSize,
  slippageCap,
  whitelist,
} from '../src/rules/index.js';
import type { PolicyContext } from '../src/types.js';

const baseCtx: PolicyContext = {
  whitelist: [
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    '0x4200000000000000000000000000000000000006',
  ],
  maxAmountIn: 1_000_000_000n,
  maxSlippageBps: 100,
  todayVolume: 0n,
  dailyCap: 5_000_000_000n,
  lastTradeAt: null,
  cooldownMs: 30_000,
};

describe('rules.maxSize', () => {
  it('passes under cap', () => {
    expect(maxSize(mockProposal({ amountIn: '500000000' }), baseCtx).pass).toBe(true);
  });
  it('fails over cap', () => {
    const r = maxSize(mockProposal({ amountIn: '2000000000' }), baseCtx);
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/exceeds/);
  });
});

describe('rules.slippageCap', () => {
  it('passes at cap', () => {
    expect(slippageCap(mockProposal({ maxSlippageBps: 100 }), baseCtx).pass).toBe(true);
  });
  it('fails over cap', () => {
    expect(slippageCap(mockProposal({ maxSlippageBps: 200 }), baseCtx).pass).toBe(false);
  });
});

describe('rules.whitelist', () => {
  it('passes for listed tokens', () => {
    expect(whitelist(mockProposal(), baseCtx).pass).toBe(true);
  });
  it('fails for unlisted tokenIn', () => {
    const r = whitelist(
      mockProposal({ tokenIn: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Hex }),
      baseCtx,
    );
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/NOT_LISTED/);
  });
  it('case-insensitive match', () => {
    const upper = baseCtx.whitelist[0]!.toUpperCase().replace('0X', '0x') as Hex;
    expect(whitelist(mockProposal({ tokenIn: upper }), baseCtx).pass).toBe(true);
  });
});

describe('rules.dailyCap', () => {
  it('passes when projected within cap', () => {
    expect(dailyCap(mockProposal({ amountIn: '1000000000' }), baseCtx).pass).toBe(true);
  });
  it('fails when projected exceeds cap', () => {
    const ctx = { ...baseCtx, todayVolume: 4_500_000_000n };
    expect(dailyCap(mockProposal({ amountIn: '1000000000' }), ctx).pass).toBe(false);
  });
});

describe('rules.cooldown', () => {
  it('passes when no prior trade', () => {
    expect(cooldown(mockProposal(), { ...baseCtx, lastTradeAt: null }).pass).toBe(true);
  });
  it('fails within cooldown window', () => {
    const ctx: PolicyContext = { ...baseCtx, lastTradeAt: Date.now() - 1000, cooldownMs: 30_000 };
    expect(cooldown(mockProposal(), ctx).pass).toBe(false);
  });
  it('passes after cooldown elapsed', () => {
    const ctx: PolicyContext = {
      ...baseCtx,
      lastTradeAt: Date.now() - 60_000,
      cooldownMs: 30_000,
    };
    expect(cooldown(mockProposal(), ctx).pass).toBe(true);
  });
});
