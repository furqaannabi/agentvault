import type { RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';
import { formatUsd, valueUsdBaseUnits } from './_value.js';

/**
 * Daily volume cap. `ctx.dailyCap` and `ctx.todayVolume` are USD-base-units
 * (6-decimal); convert proposal value to the same unit before adding.
 */
export function dailyCap(proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  const amount = BigInt(proposal.amountIn);
  const usd = valueUsdBaseUnits(proposal.tokenIn, amount);
  if (usd === null) {
    return {
      id: 'dailyCap',
      pass: false,
      detail: `unknown token ${proposal.tokenIn} — cannot value`,
    };
  }
  const projected = ctx.todayVolume + usd;
  if (projected > ctx.dailyCap) {
    return {
      id: 'dailyCap',
      pass: false,
      detail: `projected daily volume ${formatUsd(projected)} exceeds cap ${formatUsd(ctx.dailyCap)}`,
    };
  }
  return { id: 'dailyCap', pass: true };
}
