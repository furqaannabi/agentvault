import type { PublicTokenInfo } from './types'

/**
 * Format a raw bigint token amount using its decimals.
 * Falls back to the raw string if the conversion fails.
 */
export function formatTokenAmount(raw: string, decimals: number): string {
  try {
    const value   = BigInt(raw)
    const divisor = 10n ** BigInt(decimals)
    const whole   = value / divisor
    const frac    = value % divisor
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '')
    return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`
  } catch {
    return raw
  }
}

/**
 * Resolve a token address to its display symbol.
 * Falls back to a truncated address if not found.
 */
export function tokenSymbol(address: string, tokens: PublicTokenInfo[]): string {
  const hit = tokens.find((t) => t.address.toLowerCase() === address.toLowerCase())
  return hit?.symbol ?? `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Format a full swap label: "SWAP X SYMBOL_IN → SYMBOL_OUT"
 */
export function formatSwapLabel(
  amountIn:  string,
  tokenIn:   string,
  tokenOut:  string,
  tokens:    PublicTokenInfo[],
): string {
  const tIn    = tokens.find((t) => t.address.toLowerCase() === tokenIn.toLowerCase())
  const amount = tIn ? formatTokenAmount(amountIn, tIn.decimals) : amountIn
  const symIn  = tIn?.symbol ?? `${tokenIn.slice(0, 6)}…`
  const symOut = tokenSymbol(tokenOut, tokens)
  return `SWAP ${amount} ${symIn} → ${symOut}`
}
