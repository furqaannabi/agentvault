import type { Hex } from '@agentvault/types';

export interface KnownToken {
  symbol:   string;
  address:  Hex;
  decimals: number;
}

export interface ExtractedTrade {
  amountIn:  string;   // base units, exact
  tokenIn:   Hex;
  tokenOut:  Hex;
  symbolIn:  string;
  symbolOut: string;
}

// Matches: "0.00111 WETH", "100 USDC", "1.5 weth", ".5 USDC"
const AMOUNT_TOKEN_RE = /(\d+\.?\d*|\.\d+)\s*([a-zA-Z]+)/g;

// Direction words
const SWAP_TO_RE = /\b(?:to|for|into|→|-?>)\s*([a-zA-Z]+)/i;

function toBaseUnits(amount: string, decimals: number): string {
  // Split on decimal point for precision arithmetic (no floating point errors)
  const [intPart = '0', fracPart = ''] = amount.split('.');
  const frac = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const raw = BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(frac || '0');
  return raw.toString();
}

function findToken(sym: string, tokens: KnownToken[]): KnownToken | undefined {
  const upper = sym.toUpperCase();
  // ETH → WETH alias
  const lookup = upper === 'ETH' ? 'WETH' : upper;
  return tokens.find((t) => t.symbol.toUpperCase() === lookup);
}

/**
 * Attempt to extract trade intent from free-form user message.
 * Returns null if message is ambiguous or no clear token+amount found.
 */
export function extractTrade(
  msg: string,
  tokens: KnownToken[],
): ExtractedTrade | null {
  const matches: Array<{ amount: string; symbol: string }> = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_TOKEN_RE.source, 'g');
  while ((m = re.exec(msg)) !== null) {
    if (m[1] && m[2]) matches.push({ amount: m[1], symbol: m[2] });
  }

  if (matches.length === 0) return null;

  const inMatch = matches[0];
  if (!inMatch) return null;
  const tokenIn = findToken(inMatch.symbol, tokens);
  if (!tokenIn) return null;

  // tokenOut: look for "to TOKEN" pattern, or second match, or other token
  let tokenOut: KnownToken | undefined;
  const toMatch = SWAP_TO_RE.exec(msg);
  if (toMatch?.[1]) {
    tokenOut = findToken(toMatch[1], tokens);
  }
  if (!tokenOut && matches.length >= 2) {
    const second = matches[1];
    if (second) tokenOut = findToken(second.symbol, tokens);
  }
  if (!tokenOut) {
    tokenOut = tokens.find((t) => t.address !== tokenIn.address);
  }
  if (!tokenOut) return null;

  const amountIn = toBaseUnits(inMatch.amount, tokenIn.decimals);
  if (amountIn === '0') return null;

  return {
    amountIn,
    tokenIn:  tokenIn.address,
    tokenOut: tokenOut.address,
    symbolIn:  tokenIn.symbol,
    symbolOut: tokenOut.symbol,
  };
}
