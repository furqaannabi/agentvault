import type { Hex } from '@agentvault/types';

/**
 * Caller (api) builds this from current state (recent trades, configured caps).
 * Policy rules are pure fns of (proposal, ctx).
 */
export interface PolicyContext {
  /** Whitelisted token addresses (lower-cased internally). */
  whitelist: Hex[];
  /** Max amountIn (token base units). Single cap; per-token table is P2. */
  maxAmountIn: bigint;
  /** Max allowed slippage in bps. */
  maxSlippageBps: number;
  /** Sum of amountIn already traded today (token base units). */
  todayVolume: bigint;
  /** Daily volume cap (token base units). */
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
