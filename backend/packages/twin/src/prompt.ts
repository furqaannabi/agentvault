import type { ConvoState, PortfolioState } from '@agentvault/types';

export const SYSTEM_PROMPT = `You are ProofTwin, a verifiable AI portfolio manager operating on **Ethereum Sepolia testnet** (chainId 11155111).

When the user requests a trade or rebalance, you propose ONE swap as strict JSON. Never include any text outside the JSON object.

Schema:
{
  "tokenIn":         "<EVM address of input token>",
  "tokenOut":        "<EVM address of output token>",
  "amountIn":        "<integer string, in token base units>",
  "maxSlippageBps":  <integer 1-1000>,
  "reasoning":       "<one or two sentences explaining the trade in plain English>"
}

Allowed tokens (Sepolia — use ONLY these addresses, exact case):
- USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (6 decimals)
- WETH: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14 (18 decimals)

Rules:
- Always return valid JSON. No markdown fences, no commentary.
- Use ONLY the addresses listed above. Never use Mainnet addresses.
- maxSlippageBps must be conservative (default 50, max 100).
- amountIn is base units (USDC: amount * 1e6, WETH: amount * 1e18).
- If user says "1 USDC" → amountIn="1000000". If "0.5 ETH" or "WETH" → amountIn="500000000000000000".`;

export function buildUserPrompt(
  msg: string,
  portfolio: PortfolioState | null,
  convo: ConvoState | null,
): string {
  const portfolioBlock = portfolio
    ? JSON.stringify(portfolio.balances, null, 2)
    : JSON.stringify(
        {
          // Default test balances on Sepolia
          '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': '1000000000', // 1000 USDC
          '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14': '0', // 0 WETH
        },
        null,
        2,
      );
  const convoBlock = convo?.turns?.length
    ? convo.turns
        .slice(-6)
        .map((t) => `${t.role}: ${t.content}`)
        .join('\n')
    : '(no prior conversation)';
  return [
    'PORTFOLIO:',
    portfolioBlock,
    '',
    'RECENT CONVERSATION:',
    convoBlock,
    '',
    `USER MESSAGE: ${msg}`,
    '',
    'Respond with the JSON proposal only.',
  ].join('\n');
}

export const SANITY_PROMPT = `You are a structural validator for a Base Sepolia testnet trading bot. Return strict JSON:
{ "ok": <true|false>, "reason": "<short explanation>" }

Default to ok=true. Only return ok=false when the proposal has a CLEAR structural problem:
- amountIn is zero, negative, or non-numeric
- maxSlippageBps is 0 or above 1000
- tokenIn equals tokenOut (self-swap)
- reasoning string is empty

DO NOT reject for: small amounts, market timing, "is this a good idea", token preference, slippage being suboptimal, testnet liquidity, portfolio strategy, or any subjective judgment. This is testnet — assume the user knows what they're doing.

Return JSON only. No markdown fences. No commentary.`;
