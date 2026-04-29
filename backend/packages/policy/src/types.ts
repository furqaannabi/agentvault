import type { Hex } from '@agentvault/types';

/**
 * Caller (api) builds this from current state (recent trades, configured caps).
 * Policy rules are pure fns of (proposal, ctx).
 */
export interface PolicyContext {
  /** Whitelisted token addresses (lower-cased internally). */
  whitelist: Hex[];
  /** Per-trade cap in USD base units (6 decimals). Compared against the
   *  USD-valued `proposal.amountIn` so unit-agnostic across token decimals. */
  maxAmountIn: bigint;
  /** Max allowed slippage in bps. */
  maxSlippageBps: number;
  /** Sum already traded today, USD base units (6 decimals). */
  todayVolume: bigint;
  /** Daily volume cap, USD base units (6 decimals). */
  dailyCap: bigint;
  /** Last successful trade timestamp (ms epoch) or null. */
  lastTradeAt: number | null;
  /** Min ms between trades. */
  cooldownMs: number;
}

export interface PolicyDefaults {
  whitelist: Hex[];
  maxAmountIn: bigint;
  maxSlippageBps: number;
  dailyCap: bigint;
  cooldownMs: number;
}
