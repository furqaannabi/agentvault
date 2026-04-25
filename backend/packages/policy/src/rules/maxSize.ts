import type { RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';

export function maxSize(proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  const amount = BigInt(proposal.amountIn);
  if (amount > ctx.maxAmountIn) {
    return {
      id: 'maxSize',
      pass: false,
      detail: `amountIn ${amount} exceeds cap ${ctx.maxAmountIn}`,
    };
  }
  return { id: 'maxSize', pass: true };
}
