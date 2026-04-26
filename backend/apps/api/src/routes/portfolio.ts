import type { Hex } from '@agentvault/types';
import { ethers } from 'ethers';
import { Hono } from 'hono';
import type { SessionEnv } from '../middleware/session.js';
import type { PublicTokenInfo } from './config.js';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

export interface PortfolioRouteOpts {
  provider: ethers.JsonRpcProvider;
  knownTokens: PublicTokenInfo[];
}

interface BalanceEntry {
  address: Hex | 'native';
  symbol: string;
  decimals: number;
  amount: string;
}

/**
 * GET /portfolio — returns on-chain balances of session.user across the
 * tokens declared in their session.allowedTokens. Native ETH always included.
 * Symbol/decimals come from the configured knownTokens map; for unknown ERC20s
 * we fetch them on the fly (cached for the request lifetime).
 */
export function portfolioRoute(opts: PortfolioRouteOpts) {
  const known = new Map(opts.knownTokens.map((t) => [t.address.toLowerCase(), t]));
  const app = new Hono<SessionEnv>();

  app.get('/portfolio', async (c) => {
    const session = c.get('session');
    try {
      const balances: BalanceEntry[] = [];

      const ethBal = await opts.provider.getBalance(session.user);
      balances.push({ address: 'native', symbol: 'ETH', decimals: 18, amount: ethBal.toString() });

      for (const tokenAddr of session.allowedTokens) {
        const lc = tokenAddr.toLowerCase();
        // biome-ignore lint/suspicious/noExplicitAny: ethers Contract method types are dynamic
        const erc20: any = new ethers.Contract(tokenAddr, ERC20_ABI, opts.provider);
        const meta = known.get(lc);
        const [bal, symbol, decimals] = await Promise.all([
          erc20.balanceOf(session.user),
          meta ? Promise.resolve(meta.symbol) : erc20.symbol().catch(() => 'TOKEN'),
          meta ? Promise.resolve(meta.decimals) : erc20.decimals().then(Number).catch(() => 18),
        ]);
        balances.push({
          address: tokenAddr,
          symbol,
          decimals,
          amount: bal.toString(),
        });
      }

      return c.json({ user: session.user, balances, updatedAt: Date.now() });
    } catch (e) {
      return c.json({ error: 'portfolio_read_failed', detail: (e as Error).message }, 502);
    }
  });

  return app;
}
