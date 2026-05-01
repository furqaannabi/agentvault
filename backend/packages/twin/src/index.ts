import { randomUUID } from 'node:crypto';
import type { Memory } from '@agentvault/memory';
import type {
  ConvoState,
  ConvoTurn,
  TradeProposal,
  VerifiableInference,
} from '@agentvault/types';
import { ethers } from 'ethers';
import { type TwinConfig, twinConfigFromEnv } from './config.js';
import { type ComputeClient, makeComputeClient } from './compute.js';
import {
  CHAT_PROMPT,
  INTENT_PROMPT,
  PLAN_PROMPT,
  SANITY_PROMPT,
  SYSTEM_PROMPT,
  buildUserPrompt,
} from './prompt.js';
import { type KnownToken, extractTrade } from './extract.js';
import { type ParsedSanity, parseIntent, parseProposal, parseSanity } from './parse.js';
import { attestInference } from './attest.js';

export type { TwinConfig } from './config.js';
export { attestInference, keccakUtf8 } from './attest.js';
export { parseProposal, parseSanity } from './parse.js';

export interface ChatReply {
  kind: 'chat';
  reply: string;
}

export type HandleResult = TradeProposal | ChatReply;

export interface Twin {
  /** User-facing entrypoint: produce a TradeProposal or conversational reply. */
  handle(userId: string, msg: string): Promise<HandleResult>;
  /** Second LLM call used by policy.sanityCheck — also returns verifiable inference. */
  sanityCheck(proposal: TradeProposal): Promise<{ result: ParsedSanity; inference: VerifiableInference }>;
}

export interface TwinDeps {
  memory: Memory;
  cfg?: TwinConfig;
  compute?: ComputeClient;
  knownTokens?: KnownToken[];
}

const DEFAULT_TOKENS: KnownToken[] = [
  { symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  { symbol: 'WETH', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
  { symbol: 'UNI',  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'LINK', address: '0x779877A7B0D9E8603169DdbD7836e478b4624789', decimals: 18 },
];

export function createTwin(deps: TwinDeps): Twin {
  const cfg = deps.cfg ?? twinConfigFromEnv();
  const compute = deps.compute ?? makeComputeClient(cfg);
  const signer = new ethers.Wallet(cfg.privateKey);
  const tokens = deps.knownTokens ?? DEFAULT_TOKENS;

  return {
    async handle(userId, msg) {
      const t0 = Date.now();
      const [portfolio, convo] = await Promise.all([
        deps.memory.getPortfolio(userId),
        deps.memory.getConvo(userId),
      ]);
      const tKv = Date.now();
      console.log(`[twin] kv reads: ${tKv - t0}ms`);

      // Step 1: classify intent with a local fast-path to reduce provider calls.
      // Falls back to LLM intent classification only for ambiguous messages.
      const msgLc = msg.toLowerCase();
      const wantsImmediateExecution = /\b(execute|go ahead|approve|do it|swap now|trade now|execute this plan)\b/i.test(
        msg,
      );
      const looksTradeLike = /\b(swap|rebalance|buy|sell|convert|trade|for|into| to )\b/i.test(msg);
      const hasTokenHint = /\b(usdc|weth|eth|uni|link)\b/i.test(msg);
      let intent: 'trade' | 'chat';
      if (wantsImmediateExecution || (looksTradeLike && hasTokenHint)) {
        intent = 'trade';
      } else if (/\b(hello|hi|how|what|why|explain|help|status|portfolio)\b/i.test(msgLc)) {
        intent = 'chat';
      } else {
        const intentRaw = await compute.infer(INTENT_PROMPT, msg);
        intent = parseIntent(intentRaw);
      }
      console.log(`[twin] intent: ${intent}`);

      // Step 2a: conversational reply
      if (intent === 'chat') {
        const convoBlock = convo?.turns?.length
          ? convo.turns.slice(-6).map((t: ConvoTurn) => `${t.role}: ${t.content}`).join('\n')
          : '(no prior conversation)';
        const chatUserPrompt = `RECENT CONVERSATION:\n${convoBlock}\n\nUSER MESSAGE: ${msg}`;
        const reply = await compute.infer(CHAT_PROMPT, chatUserPrompt);
        const newTurn: ConvoTurn = { role: 'user', content: msg, ts: Date.now() };
        const replyTurn: ConvoTurn = { role: 'assistant', content: reply, ts: Date.now() };
        const updatedConvo: ConvoState = {
          userId,
          turns: [...(convo?.turns ?? []), newTurn, replyTurn],
          updatedAt: Date.now(),
        };
        await deps.memory.setConvo(updatedConvo);
        console.log(`[twin] handle total: ${Date.now() - t0}ms`);
        return { kind: 'chat', reply } satisfies ChatReply;
      }

      // Step 2b: plan-first trade flow
      let extracted = extractTrade(msg, tokens);
      if (extracted) console.log(`[twin] extracted: ${extracted.amountIn} ${extracted.symbolIn} → ${extracted.symbolOut}`);

      // If user says "execute this plan" but the current message has no amount/token,
      // scan recent conversation history to re-extract the original trade intent.
      // This prevents the LLM from guessing amountIn with wrong decimals.
      if (!extracted && wantsImmediateExecution && convo?.turns?.length) {
        for (let i = convo.turns.length - 1; i >= 0 && !extracted; i--) {
          const turn = convo.turns[i];
          if (turn && turn.role === 'user') {
            extracted = extractTrade(turn.content, tokens);
            if (extracted) {
              console.log(`[twin] re-extracted from convo turn ${i}: ${extracted.amountIn} ${extracted.symbolIn} → ${extracted.symbolOut}`);
            }
          }
        }
      }

      if (!wantsImmediateExecution) {
        const planPrompt = [
          'PORTFOLIO:',
          portfolio ? JSON.stringify(portfolio.balances, null, 2) : '{}',
          '',
          `USER REQUEST: ${msg}`,
        ].join('\n');
        const planText = await compute.infer(PLAN_PROMPT, planPrompt);
        const newTurn: ConvoTurn = { role: 'user', content: msg, ts: Date.now() };
        const replyTurn: ConvoTurn = { role: 'assistant', content: planText, ts: Date.now() };
        const updatedConvo: ConvoState = {
          userId,
          turns: [...(convo?.turns ?? []), newTurn, replyTurn],
          updatedAt: Date.now(),
        };
        await deps.memory.setConvo(updatedConvo);
        console.log('[twin] returned plan (awaiting explicit execution confirmation)');
        console.log(`[twin] handle total: ${Date.now() - t0}ms`);
        return { kind: 'chat', reply: planText } satisfies ChatReply;
      }

      let tokenIn: string;
      let tokenOut: string;
      let amountIn: string;
      let maxSlippageBps: number;
      let reasoning: string;
      let promptStr: string;
      let output: string;

      if (extracted) {
        // Rule-based fields locked — only ask LLM for reasoning + slippage
        const reasoningPrompt = `User wants to swap ${extracted.symbolIn} to ${extracted.symbolOut}. Write one sentence of reasoning for this trade and suggest a conservative slippage in bps (default 50, max 100). Return JSON: {"reasoning":"...","maxSlippageBps":<number>}`;
        output = await compute.infer(
          'You are a DeFi trade reasoning assistant. Return strict JSON only, no markdown.',
          reasoningPrompt,
        );
        const tCompute = Date.now();
        console.log(`[twin] compute: ${tCompute - tKv}ms`);
        let parsed: { reasoning?: string; maxSlippageBps?: number } = {};
        try { parsed = JSON.parse(output.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { /* use defaults */ }
        tokenIn = extracted.tokenIn;
        tokenOut = extracted.tokenOut;
        amountIn = extracted.amountIn;
        maxSlippageBps = typeof parsed.maxSlippageBps === 'number' && parsed.maxSlippageBps > 0 && parsed.maxSlippageBps <= 1000 ? parsed.maxSlippageBps : 50;
        const baseReasoning =
          typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
            ? parsed.reasoning
            : `Swapping ${extracted.symbolIn} to ${extracted.symbolOut} as requested.`;
        reasoning = `${baseReasoning} Plan basis: optimized for requested goal with conservative slippage and execution reliability.`;
        promptStr = reasoningPrompt;
      } else {
        // Ambiguous message — let LLM decide everything
        const userPrompt = buildUserPrompt(msg, portfolio, convo, null);
        output = await compute.infer(SYSTEM_PROMPT, userPrompt);
        const tCompute = Date.now();
        console.log(`[twin] compute: ${tCompute - tKv}ms`);
        const parsed = parseProposal(output);
        tokenIn = parsed.tokenIn;
        tokenOut = parsed.tokenOut;
        amountIn = parsed.amountIn;
        maxSlippageBps = parsed.maxSlippageBps;
        reasoning = parsed.reasoning;
        promptStr = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
      }

      const inference = await attestInference(signer, {
        providerUrl: cfg.computeBaseUrl,
        modelId: cfg.computeModel,
        prompt: promptStr,
        output,
      });
      const proposal: TradeProposal = {
        id: `prop_${randomUUID()}`,
        userId,
        action: 'swap',
        tokenIn: tokenIn as `0x${string}`,
        tokenOut: tokenOut as `0x${string}`,
        amountIn,
        maxSlippageBps,
        reasoning,
        inference,
        createdAt: Date.now(),
      };
      const newTurn: ConvoTurn = { role: 'user', content: msg, ts: Date.now() };
      const replyTurn: ConvoTurn = { role: 'assistant', content: reasoning, ts: Date.now() };
      const updatedConvo: ConvoState = {
        userId,
        turns: [...(convo?.turns ?? []), newTurn, replyTurn],
        updatedAt: Date.now(),
      };
      await deps.memory.setConvo(updatedConvo);
      await deps.memory.setProposal(proposal);
      console.log(`[twin] handle total: ${Date.now() - t0}ms`);
      return proposal;
    },

    async sanityCheck(proposal) {
      const userPrompt = `Review this proposal:\n${JSON.stringify(
        {
          tokenIn: proposal.tokenIn,
          tokenOut: proposal.tokenOut,
          amountIn: proposal.amountIn,
          maxSlippageBps: proposal.maxSlippageBps,
          reasoning: proposal.reasoning,
        },
        null,
        2,
      )}`;
      const output = await compute.infer(SANITY_PROMPT, userPrompt);
      const result = parseSanity(output);
      console.log(`[twin] sanity: ok=${result.ok} reason="${result.reason}"`);
      const inference = await attestInference(signer, {
        providerUrl: cfg.computeBaseUrl,
        modelId: cfg.computeModel,
        prompt: `${SANITY_PROMPT}\n\n${userPrompt}`,
        output,
      });
      return { result, inference };
    },
  };
}
