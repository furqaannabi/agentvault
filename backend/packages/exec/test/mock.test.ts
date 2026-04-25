import { mockProposal, mockVerdict } from '@agentvault/mocks';
import { describe, expect, it } from 'vitest';
import { createExecAdapter } from '../src/index.js';

describe('exec mock adapter', () => {
  const adapter = createExecAdapter({ mode: 'mock' });

  it('returns success for ok verdict', async () => {
    const r = await adapter.swap({
      proposal: mockProposal({ amountIn: '1000000' }),
      verdict: mockVerdict({ ok: true }),
    });
    expect(r.status).toBe('success');
    expect(r.proposalId).toBe('prop_mock_001');
    expect(BigInt(r.amountOut)).toBeGreaterThan(0n);
  });

  it('returns failed for not-ok verdict', async () => {
    const r = await adapter.swap({
      proposal: mockProposal(),
      verdict: mockVerdict({ ok: false }),
    });
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/verdict\.ok=false/);
  });

  it('amountOut scales with amountIn', async () => {
    const small = await adapter.swap({
      proposal: mockProposal({ id: 'a', amountIn: '1000000' }),
      verdict: mockVerdict({ proposalId: 'a' }),
    });
    const big = await adapter.swap({
      proposal: mockProposal({ id: 'b', amountIn: '5000000' }),
      verdict: mockVerdict({ proposalId: 'b' }),
    });
    expect(BigInt(big.amountOut)).toBeGreaterThan(BigInt(small.amountOut));
  });
});
