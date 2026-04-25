import { mockExecResult, mockProposal, mockVerdict } from '@agentvault/mocks';
import { describe, expect, it } from 'vitest';
import { canonicalize, computeRoot, hashCanonical } from '../src/hash.js';

describe('canonicalize', () => {
  it('sorts keys at every depth', () => {
    const a = { b: 1, a: { y: 2, x: 1 } };
    const b = { a: { x: 1, y: 2 }, b: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });
  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });
});

describe('hashCanonical', () => {
  it('is order-invariant for object keys', () => {
    expect(hashCanonical({ a: 1, b: 2 })).toBe(hashCanonical({ b: 2, a: 1 }));
  });
  it('differs for different content', () => {
    expect(hashCanonical({ a: 1 })).not.toBe(hashCanonical({ a: 2 }));
  });
});

describe('computeRoot', () => {
  it('is deterministic for same inputs', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const e = mockExecResult();
    expect(computeRoot(p, v, e)).toBe(computeRoot(p, v, e));
  });
  it('changes when proposal changes', () => {
    const v = mockVerdict();
    const e = mockExecResult();
    const r1 = computeRoot(mockProposal({ amountIn: '100' }), v, e);
    const r2 = computeRoot(mockProposal({ amountIn: '200' }), v, e);
    expect(r1).not.toBe(r2);
  });
  it('changes when verdict changes', () => {
    const p = mockProposal();
    const e = mockExecResult();
    const r1 = computeRoot(p, mockVerdict({ ok: true }), e);
    const r2 = computeRoot(p, mockVerdict({ ok: false }), e);
    expect(r1).not.toBe(r2);
  });
  it('changes when exec changes', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const r1 = computeRoot(p, v, mockExecResult({ amountOut: '1' }));
    const r2 = computeRoot(p, v, mockExecResult({ amountOut: '2' }));
    expect(r1).not.toBe(r2);
  });
});
