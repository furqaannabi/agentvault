import type { RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';

export function slippageCap(proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  if (proposal.action !== 'swap') {
    return { id: 'slippageCap', pass: true };
  }
  const slippage = proposal.maxSlippageBps ?? 0;
  if (slippage > ctx.maxSlippageBps) {
    return {
      id: 'slippageCap',
      pass: false,
      detail: `slippage ${slippage}bps exceeds cap ${ctx.maxSlippageBps}bps`,
    };
  }
  return { id: 'slippageCap', pass: true };
}
