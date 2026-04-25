import { describe, expect, it } from 'vitest';
import { parseProposal, parseSanity } from '../src/parse.js';

const valid = {
  tokenIn: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  tokenOut: '0x4200000000000000000000000000000000000006',
  amountIn: '500000000',
  maxSlippageBps: 50,
  reasoning: 'rebalance',
};

describe('parseProposal', () => {
  it('parses clean JSON', () => {
    const p = parseProposal(JSON.stringify(valid));
    expect(p.tokenIn).toBe(valid.tokenIn);
    expect(p.amountIn).toBe(valid.amountIn);
    expect(p.maxSlippageBps).toBe(50);
  });
  it('strips ```json fences', () => {
    const fenced = '```json\n' + JSON.stringify(valid) + '\n```';
    expect(parseProposal(fenced).reasoning).toBe('rebalance');
  });
  it('rejects invalid address', () => {
    expect(() => parseProposal(JSON.stringify({ ...valid, tokenIn: 'not-an-addr' }))).toThrow();
  });
  it('rejects non-integer amountIn', () => {
    expect(() => parseProposal(JSON.stringify({ ...valid, amountIn: '1.5' }))).toThrow();
  });
  it('rejects out-of-range slippage', () => {
    expect(() => parseProposal(JSON.stringify({ ...valid, maxSlippageBps: 0 }))).toThrow();
    expect(() => parseProposal(JSON.stringify({ ...valid, maxSlippageBps: 5000 }))).toThrow();
  });
  it('rejects missing reasoning', () => {
    expect(() => parseProposal(JSON.stringify({ ...valid, reasoning: '' }))).toThrow();
  });
  it('rejects garbage', () => {
    expect(() => parseProposal('not json')).toThrow();
  });
});

describe('parseSanity', () => {
  it('parses ok=true', () => {
    expect(parseSanity('{"ok":true,"reason":"fine"}')).toEqual({ ok: true, reason: 'fine' });
  });
  it('parses ok=false', () => {
    expect(parseSanity('{"ok":false,"reason":"too big"}').ok).toBe(false);
  });
  it('rejects missing ok', () => {
    expect(() => parseSanity('{"reason":"x"}')).toThrow();
  });
});
