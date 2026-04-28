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
  it('changes when ExecResult.keeperhub block is added (PRD FR-3 binding)', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const base = mockExecResult();
    const withKh = mockExecResult({
      keeperhub: {
        jobId: 'direct_demo_1',
        auditTrailUrl: 'https://app.keeperhub.com/executions/direct_demo_1',
        attempts: 2,
        finalTxHash: ('0x' + 'a'.repeat(64)) as `0x${string}`,
        finalGasUsed: '150000',
        status: 'success',
        network: 'sepolia',
      },
    });
    expect(computeRoot(p, v, base)).not.toBe(computeRoot(p, v, withKh));
  });
  it('changes when keeperhub.attempts changes (retry count is bound to proof)', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const e1 = mockExecResult({
      keeperhub: {
        jobId: 'direct_demo_2',
        auditTrailUrl: 'https://app.keeperhub.com/executions/direct_demo_2',
        attempts: 1,
        finalTxHash: ('0x' + 'b'.repeat(64)) as `0x${string}`,
        finalGasUsed: '150000',
        status: 'success',
        network: 'sepolia',
      },
    });
    const e2 = mockExecResult({
      keeperhub: { ...e1.keeperhub!, attempts: 2 },
    });
    expect(computeRoot(p, v, e1)).not.toBe(computeRoot(p, v, e2));
  });
});
