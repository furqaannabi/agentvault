import type { RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';

export function dailyCap(proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  const incoming = BigInt(proposal.amountIn);
  const projected = ctx.todayVolume + incoming;
  if (projected > ctx.dailyCap) {
    return {
      id: 'dailyCap',
      pass: false,
      detail: `projected volume ${projected} exceeds daily cap ${ctx.dailyCap}`,
    };
  }
  return { id: 'dailyCap', pass: true };
}
