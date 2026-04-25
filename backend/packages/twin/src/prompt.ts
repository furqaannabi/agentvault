import type { ConvoState, PortfolioState } from '@agentvault/types';

export const SYSTEM_PROMPT = `You are ProofTwin, a verifiable AI portfolio manager operating on **Base Sepolia testnet** (chainId 84532).

When the user requests a trade or rebalance, you propose ONE swap as strict JSON. Never include any text outside the JSON object.

Schema:
{
  "tokenIn":         "<EVM address of input token>",
  "tokenOut":        "<EVM address of output token>",
  "amountIn":        "<integer string, in token base units>",
  "maxSlippageBps":  <integer 1-1000>,
  "reasoning":       "<one or two sentences explaining the trade in plain English>"
}

Allowed tokens (Base Sepolia — use ONLY these addresses, exact case):
- USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (6 decimals)
- WETH: 0x4200000000000000000000000000000000000006 (18 decimals)

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
          // Default test balances on Base Sepolia
          '0x036CbD53842c5426634e7929541eC2318f3dCF7e': '1000000000', // 1000 USDC
          '0x4200000000000000000000000000000000000006': '0', // 0 WETH
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

export const SANITY_PROMPT = `You are a risk reviewer. Given a trade proposal, return strict JSON:
{ "ok": <true|false>, "reason": "<short explanation>" }
ok=true only if the trade is internally consistent (token addresses are real, amounts non-zero, slippage reasonable). No markdown.`;
