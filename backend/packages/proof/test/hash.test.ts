import { mockExecResult, mockProposal, mockVerdict } from '@agentvault/mocks';
import type { KeeperhubExecution } from '@agentvault/types';
import { describe, expect, it } from 'vitest';
import { canonicalize, computeRoot, hashCanonical, hashKeeperhub } from '../src/hash.js';

function mockKhReceipt(over: Partial<KeeperhubExecution> = {}): KeeperhubExecution {
  return {
    kind: 'swap',
    jobId: 'direct_test_1',
    auditTrailUrl: 'https://app.keeperhub.com/executions/direct_test_1',
    attempts: 1,
    finalTxHash: ('0x' + 'a'.repeat(64)) as `0x${string}`,
    finalGasUsed: '150000',
    status: 'success',
    network: 'sepolia',
    ...over,
  };
}

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
      keeperhub: mockKhReceipt({ jobId: 'direct_demo_1', attempts: 2 }),
    });
    expect(computeRoot(p, v, base)).not.toBe(computeRoot(p, v, withKh));
  });
  it('changes when keeperhub.attempts changes (retry count is bound to proof)', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const e1 = mockExecResult({
      keeperhub: mockKhReceipt({ jobId: 'direct_demo_2', attempts: 1 }),
    });
    const e2 = mockExecResult({
      keeperhub: { ...e1.keeperhub!, attempts: 2 },
    });
    expect(computeRoot(p, v, e1)).not.toBe(computeRoot(p, v, e2));
  });
  it('rootHash differs between empty receipts and populated receipts (4-leaf, Item 3)', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const e = mockExecResult();
    const empty = computeRoot(p, v, e);
    const withReceipt = computeRoot(p, v, e, [mockKhReceipt()]);
    expect(empty).not.toBe(withReceipt);
  });
  it('empty receipts and undefined receipts hash identically', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const e = mockExecResult();
    expect(computeRoot(p, v, e)).toBe(computeRoot(p, v, e, []));
  });
  it('rootHash depends on receipts ORDER (positional binding)', () => {
    const p = mockProposal();
    const v = mockVerdict();
    const e = mockExecResult();
    const approval = mockKhReceipt({ kind: 'approval', jobId: 'direct_approval_1' });
    const swap = mockKhReceipt({ kind: 'swap', jobId: 'direct_swap_1' });
    const r1 = computeRoot(p, v, e, [approval, swap]);
    const r2 = computeRoot(p, v, e, [swap, approval]);
    expect(r1).not.toBe(r2);
  });
  it('hashKeeperhub returns a stable value for empty input', () => {
    expect(hashKeeperhub([])).toBe(hashKeeperhub(undefined));
    expect(hashKeeperhub([])).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
