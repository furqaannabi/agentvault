import type { ExecAdapter, ExecResult, ExecSwapInput } from '@agentvault/types';
import type { ExecConfig } from './index.js';

/**
 * BE2 OWNS THIS FILE.
 *
 * Implement Uniswap v3 quote + swap on Sepolia. Must:
 *  - Honor proposal.maxSlippageBps when building swapParams
 *  - Wait for receipt and parse Swap log → amountOut
 *  - Return ExecResult with status='success' on confirmation
 *  - Return ExecResult with status='reverted' | 'failed' + error msg on any error (NEVER throw)
 *  - Be idempotent on proposal.id (cache last result by proposalId)
 *
 * Sub-modules suggested:
 *   packages/wallet     — viem signer, gas, nonce, tx wait
 *   packages/uniswap    — v3 quoter + router calls
 *
 * Imported by apps/api when EXEC_MODE=real.
 */
export function realAdapter(config: ExecConfig): ExecAdapter {
  return {
    async swap({ proposal }: ExecSwapInput): Promise<ExecResult> {
      void config;
      return {
        proposalId: proposal.id,
        txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        blockNumber: 0,
        amountOut: '0',
        gasUsed: '0',
        status: 'failed',
        error: 'real adapter not implemented yet (BE2 scope)',
        chainId: 11155111,
      };
    },
  };
}
