import type { Hex } from '@agentvault/types';
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
  // Base Sepolia USDC + WETH; widen as needed
  whitelist: [
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC Base Sepolia
    '0x4200000000000000000000000000000000000006', // WETH Base Sepolia
  ],
  maxAmountIn: 1_000_000_000n, // 1000 USDC base units
  maxSlippageBps: 100, // 1.00%
  dailyCap: 5_000_000_000n, // 5000 USDC base units
  cooldownMs: 30_000, // 30s
};
