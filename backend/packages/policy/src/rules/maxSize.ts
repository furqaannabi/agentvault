import type { RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';
import { formatUsd, valueUsdBaseUnits } from './_value.js';

/**
 * Compares trade value (USD base units) against session cap. Both sides must
 * be in the same unit — `ctx.maxAmountIn` arrives 6-decimal-USD from
 * `policyFromSession`, but `proposal.amountIn` is token-native (e.g. 18-dec
 * WETH). Without conversion, every WETH trade was failing the cap.
 */
export function maxSize(proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  const amount = BigInt(proposal.amountIn);
  const usd = valueUsdBaseUnits(proposal.tokenIn, amount);
  if (usd === null) {
    // Unknown token — fail-closed since we can't reason about value.
    return {
      id: 'maxSize',
      pass: false,
      detail: `unknown token ${proposal.tokenIn} — cannot value`,
    };
  }
  if (usd > ctx.maxAmountIn) {
    return {
      id: 'maxSize',
      pass: false,
      detail: `${formatUsd(usd)} exceeds per-trade cap ${formatUsd(ctx.maxAmountIn)}`,
    };
  }
  return { id: 'maxSize', pass: true };
}
