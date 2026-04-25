import type { RuleResult, TradeProposal } from '@agentvault/types';
import type { PolicyContext } from '../types.js';

export function cooldown(_proposal: TradeProposal, ctx: PolicyContext): RuleResult {
  if (ctx.lastTradeAt === null) return { id: 'cooldown', pass: true };
  const elapsed = Date.now() - ctx.lastTradeAt;
  if (elapsed < ctx.cooldownMs) {
    return {
      id: 'cooldown',
      pass: false,
      detail: `${elapsed}ms since last trade < cooldown ${ctx.cooldownMs}ms`,
    };
  }
  return { id: 'cooldown', pass: true };
}
