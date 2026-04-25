import type { RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';

export function slippageCap(proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  if (proposal.maxSlippageBps > ctx.maxSlippageBps) {
    return {
      id: 'slippageCap',
      pass: false,
      detail: `slippage ${proposal.maxSlippageBps}bps exceeds cap ${ctx.maxSlippageBps}bps`,
    };
  }
  return { id: 'slippageCap', pass: true };
}
