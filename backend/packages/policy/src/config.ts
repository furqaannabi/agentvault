import type { AgentSession, Hex } from '@agentvault/types';
import type { PolicyDefaults } from './types.js';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

export function policySignerKey(): Hex {
  return req('ZG_PRIVATE_KEY') as Hex;
}

/**
 * Hackathon defaults. Tune via env in production.
 * USDC has 6 decimals; cap = 1000 USDC = 1_000_000_000 base units.
 */
export const DEFAULT_POLICY: PolicyDefaults = {
  // Ethereum Sepolia USDC + WETH (Uniswap Trade API liquidity available here)
  whitelist: [
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC Sepolia
    '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // WETH Sepolia
  ],
  maxAmountIn: 1_000_000_000n, // 1000 USDC base units
  maxSlippageBps: 100, // 1.00%
  dailyCap: 5_000_000_000n, // 5000 USDC base units
  cooldownMs: 30_000, // 30s
};

/**
 * Project per-user bounds from a signed AgentSession to PolicyDefaults.
 * USD figures map 1:1 to 6-decimal stablecoin base units (USDC convention).
 * Cooldown converted from seconds to ms.
 */
export function policyFromSession(session: AgentSession): PolicyDefaults {
  const usdToBase = (usd: number) => BigInt(Math.floor(usd)) * 1_000_000n;
  return {
    whitelist: session.allowedTokens.map((a) => a.toLowerCase() as Hex),
    maxAmountIn: usdToBase(session.maxTradeUsd),
    maxSlippageBps: session.maxSlippageBps,
    dailyCap: usdToBase(session.maxDailyVolumeUsd),
    cooldownMs: session.cooldownSec * 1000,
  };
}
