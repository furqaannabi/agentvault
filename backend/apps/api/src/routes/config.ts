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
  if (!env) return [];
  return env
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
}
