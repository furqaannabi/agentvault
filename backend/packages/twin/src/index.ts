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
import { CHAT_PROMPT, INTENT_PROMPT, SANITY_PROMPT, SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
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
}

export function createTwin(deps: TwinDeps): Twin {
  const cfg = deps.cfg ?? twinConfigFromEnv();
  const compute = deps.compute ?? makeComputeClient(cfg);
  const signer = new ethers.Wallet(cfg.privateKey);

  return {
    async handle(userId, msg) {
      const t0 = Date.now();
      const [portfolio, convo] = await Promise.all([
        deps.memory.getPortfolio(userId),
        deps.memory.getConvo(userId),
      ]);
      const tKv = Date.now();
      console.log(`[twin] kv reads: ${tKv - t0}ms`);

      // Step 1: classify intent
      const intentRaw = await compute.infer(INTENT_PROMPT, msg);
      const intent = parseIntent(intentRaw);
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

      // Step 2b: trade proposal
      const userPrompt = buildUserPrompt(msg, portfolio, convo);
      const output = await compute.infer(SYSTEM_PROMPT, userPrompt);
      const tCompute = Date.now();
      console.log(`[twin] compute: ${tCompute - tKv}ms`);
      const parsed = parseProposal(output);
      const inference = await attestInference(signer, {
        providerUrl: cfg.computeBaseUrl,
        modelId: cfg.computeModel,
        prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
        output,
      });
      const proposal: TradeProposal = {
        id: `prop_${randomUUID()}`,
        userId,
        action: 'swap',
        tokenIn: parsed.tokenIn,
        tokenOut: parsed.tokenOut,
        amountIn: parsed.amountIn,
        maxSlippageBps: parsed.maxSlippageBps,
        reasoning: parsed.reasoning,
        inference,
        createdAt: Date.now(),
      };
      const newTurn: ConvoTurn = { role: 'user', content: msg, ts: Date.now() };
      const replyTurn: ConvoTurn = { role: 'assistant', content: parsed.reasoning, ts: Date.now() };
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
