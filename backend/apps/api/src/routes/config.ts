import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  EIP712_TYPES,
} from '@agentvault/policy';
import type { ExecMode, Hex } from '@agentvault/types';
import { Hono } from 'hono';

export interface PublicTokenInfo {
  address: Hex;
  symbol: string;
  decimals: number;
}

const DEFAULT_ALLOWED_TOKENS: PublicTokenInfo[] = [
  { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', symbol: 'USDC', decimals: 6 },
  { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', symbol: 'WETH', decimals: 18 },
  { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', decimals: 18 },
];

export type ExecutionLayer = 'mock' | 'direct' | 'keeperhub';

export interface ConfigRouteOpts {
  delegate: Hex;
  chainId: number;
  allowedTokens: PublicTokenInfo[];
  /** Drives the public executionLayer label. */
  execMode: ExecMode;
}

/**
 * Map internal ExecMode → public executionLayer label.
 *  - mock      → "mock"
 *  - real      → "direct" (raw ethers + Uniswap UR)
 *  - keeperhub → "keeperhub"
 */
export function executionLayerOf(mode: ExecMode): ExecutionLayer {
  switch (mode) {
    case 'mock':
      return 'mock';
    case 'real':
      return 'direct';
    case 'keeperhub':
      return 'keeperhub';
    default: {
      const _exhaustive: never = mode;
      throw new Error(`unknown ExecMode ${String(_exhaustive)}`);
    }
  }
}

/**
 * GET /config — public endpoint FE reads on boot to learn the EIP-712 domain,
 * the delegate address users must encode in their session, the active chainId,
 * the canonical token list FE renders in onboarding, and the active execution
 * layer + chainId for the trust badge (PRD FR-5).
 */
export function configRoute(opts: ConfigRouteOpts) {
  const app = new Hono();
  app.get('/config', (c) =>
    c.json({
      delegate: opts.delegate,
      chainId: opts.chainId,
      executionLayer: executionLayerOf(opts.execMode),
      eip712Domain: {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId: opts.chainId,
      },
      eip712Types: EIP712_TYPES,
      allowedTokens: opts.allowedTokens,
    }),
  );
  return app;
}

export function parseAllowedTokens(env: string | undefined): PublicTokenInfo[] {
  if (!env || !env.trim()) return DEFAULT_ALLOWED_TOKENS;
  const parsed = env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [address, symbol = 'TOKEN', decimals = '18'] = entry.split(':');
      return {
        address: address as Hex,
        symbol,
        decimals: Number(decimals),
      };
    });
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_TOKENS;
}
