import type { Hex } from '@agentvault/types';

/**
 * Uniswap Universal Router deployments on Ethereum Sepolia (chainId 11155111).
 * Verified against
 * https://raw.githubusercontent.com/Uniswap/universal-router/main/deploy-addresses/sepolia.json
 *
 * The Uniswap Trade API picks one of these based on the `x-universal-router-version`
 * header (1.2 vs 2.0). AgentVault's Trade API client defaults to 2.0, so
 * UNIVERSAL_ROUTER_SEPOLIA points at V2. The exec adapter still prefers
 * `tx0.to` from the swap response when present — the constant is only a
 * safety default for the rare path where the API omits the destination.
 */
export const UNIVERSAL_ROUTER_V2_SEPOLIA: Hex =
  '0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b';
export const UNIVERSAL_ROUTER_V1_2_SEPOLIA: Hex =
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD';
export const UNIVERSAL_ROUTER_SEPOLIA: Hex = UNIVERSAL_ROUTER_V2_SEPOLIA;

/**
 * Minimal ABI for the Universal Router. The Trade API hands us calldata for
 * `execute(bytes,bytes[],uint256)` (commands, inputs, deadline) — this is the
 * function we re-encode through KeeperHub's contract-call endpoint.
 *
 * Tuple form is intentionally narrow. Universal Router exposes two execute
 * overloads; we only need the deadline-bearing one because that's what the
 * Trade API returns for swaps with permit2.
 */
export const UNIVERSAL_ROUTER_EXECUTE_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

/**
 * Minimal ERC-20 `approve(address,uint256)` ABI used to re-encode Trade API
 * approval transactions through KeeperHub's contract-call endpoint. The Trade
 * API's /check_approval response always targets ERC20.approve(permit2, amount).
 */
export const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
