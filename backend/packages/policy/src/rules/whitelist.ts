import type { Hex, RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';

const lc = (h: Hex) => h.toLowerCase() as Hex;

export function whitelist(proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  const set = new Set(ctx.whitelist.map(lc));
  const inOk = set.has(lc(proposal.tokenIn));
  const outOk = set.has(lc(proposal.tokenOut));
  if (!inOk || !outOk) {
    return {
      id: 'whitelist',
      pass: false,
      detail: `tokenIn=${inOk ? 'ok' : 'NOT_LISTED'} tokenOut=${outOk ? 'ok' : 'NOT_LISTED'}`,
    };
  }
  return { id: 'whitelist', pass: true };
}
