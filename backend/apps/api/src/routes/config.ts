import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  EIP712_TYPES,
} from '@agentvault/policy';
import type { Hex } from '@agentvault/types';
import { Hono } from 'hono';

export interface PublicTokenInfo {
  address: Hex;
  symbol: string;
  decimals: number;
}

export interface ConfigRouteOpts {
  delegate: Hex;
  chainId: number;
  allowedTokens: PublicTokenInfo[];
}

/**
 * GET /config — public endpoint FE reads on boot to learn the EIP-712 domain,
 * the delegate address users must encode in their session, the active chainId,
 * and the canonical token list FE renders in onboarding.
 */
export function configRoute(opts: ConfigRouteOpts) {
  const app = new Hono();
  app.get('/config', (c) =>
    c.json({
      delegate: opts.delegate,
      chainId: opts.chainId,
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
