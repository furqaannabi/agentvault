import type { ConvoState, PortfolioState } from '@agentvault/types';

export const SYSTEM_PROMPT = `You are ProofTwin, a verifiable AI portfolio manager.

When the user requests a trade or rebalance, you propose ONE swap as strict JSON. Never include any text outside the JSON object.

Schema:
{
  "tokenIn":         "<EVM address of input token>",
  "tokenOut":        "<EVM address of output token>",
  "amountIn":        "<integer string, in token base units>",
  "maxSlippageBps":  <integer 1-1000>,
  "reasoning":       "<one or two sentences explaining the trade in plain English>"
}

Rules:
- Always return valid JSON. No markdown fences, no commentary.
- Use addresses + balances from the supplied portfolio context.
- maxSlippageBps must be conservative (default 50).
- amountIn is base units (e.g. USDC has 6 decimals, ETH has 18).`;

export function buildUserPrompt(
  msg: string,
  portfolio: PortfolioState | null,
  convo: ConvoState | null,
): string {
  const portfolioBlock = portfolio
    ? JSON.stringify(portfolio.balances, null, 2)
    : '(no portfolio loaded — use sensible testnet defaults)';
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

export const SANITY_PROMPT = `You are a risk reviewer. Given a trade proposal, return strict JSON:
{ "ok": <true|false>, "reason": "<short explanation>" }
ok=true only if the trade is internally consistent (token addresses are real, amounts non-zero, slippage reasonable). No markdown.`;
