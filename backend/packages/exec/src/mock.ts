import { mockExecResult } from '@agentvault/mocks';
import type { ExecAdapter, ExecResult, ExecSwapInput } from '@agentvault/types';

export function mockAdapter(): ExecAdapter {
  return {
    async swap({ proposal, verdict }: ExecSwapInput): Promise<ExecResult> {
      if (!verdict.ok) {
        return mockExecResult({
          proposalId: proposal.id,
          status: 'failed',
          error: 'mock: verdict.ok=false',
          txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          blockNumber: 0,
          amountOut: '0',
          gasUsed: '0',
        });
      }
      // Synthetic happy path. Pretend ~0.00036 ETH per USDC.
      const amountIn = BigInt(proposal.amountIn);
      const synthetic = (amountIn * 360_000_000_000_000n) / 1_000_000n;
      return mockExecResult({
        proposalId: proposal.id,
        amountOut: synthetic.toString(),
      });
    },
  };
}
