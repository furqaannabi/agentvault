import type { Hex } from '@agentvault/types';

/**
 * Hackathon-grade USD valuation: rough fixed prices per known Sepolia token.
 * Lets us compare WETH (18-decimals) trades against USD-denominated session
 * caps (6-decimals USDC convention) without wiring a price oracle.
 *
 * Replace with Pyth/Chainlink read in P2.
 */
const TOKEN_USD: Record<string, { decimals: number; usdPerWhole: number }> = {
  // WETH Sepolia
  '0xfff9976782d46cc05630d1f6ebab18b2324d6b14': { decimals: 18, usdPerWhole: 3000 },
  // USDC Sepolia
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { decimals: 6, usdPerWhole: 1 },
  // UNI Sepolia (Uniswap test deployment) — Sepolia pool currently has the deepest WETH liquidity
  '0x1f9840a85d5af5bf1d1762f925baddc4201f984': { decimals: 18, usdPerWhole: 8 },
  // LINK Sepolia
  '0x779877a7b0d9e8603169ddbd7836e478b4624789': { decimals: 18, usdPerWhole: 15 },
};

/**
 * Convert a token amount (in token-native base units) to USD base units
 * (6 decimals — matches `policyFromSession` output). Returns null when the
 * token is unknown so callers can choose fail-open or fail-closed semantics.
 */
export function valueUsdBaseUnits(tokenAddr: Hex, amount: bigint): bigint | null {
  const meta = TOKEN_USD[tokenAddr.toLowerCase()];
  if (!meta) return null;
  const oneToken = 10n ** BigInt(meta.decimals);
  // amount * usdPerWhole * 1_000_000 / oneToken — integer math, no precision loss.
  return (amount * BigInt(meta.usdPerWhole) * 1_000_000n) / oneToken;
}

/** Pretty-print USD base units as `$<amount>` for verdict reasons. */
export function formatUsd(baseUnits: bigint): string {
  const whole = baseUnits / 1_000_000n;
  const frac = (baseUnits % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
  return `$${whole}.${frac}`;
}
