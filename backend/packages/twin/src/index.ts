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
import { SANITY_PROMPT, SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { type ParsedSanity, parseProposal, parseSanity } from './parse.js';
import { attestInference } from './attest.js';

export type { TwinConfig } from './config.js';
export { attestInference, keccakUtf8 } from './attest.js';
export { parseProposal, parseSanity } from './parse.js';

export interface Twin {
  /** User-facing entrypoint: produce a TradeProposal with a verifiable inference record. */
  handle(userId: string, msg: string): Promise<TradeProposal>;
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
      const [portfolio, convo] = await Promise.all([
        deps.memory.getPortfolio(userId),
        deps.memory.getConvo(userId),
      ]);
      const userPrompt = buildUserPrompt(msg, portfolio, convo);
      const output = await compute.infer(SYSTEM_PROMPT, userPrompt);
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
      // Persist convo turn + proposal
      const newTurn: ConvoTurn = { role: 'user', content: msg, ts: Date.now() };
      const replyTurn: ConvoTurn = {
        role: 'assistant',
        content: parsed.reasoning,
        ts: Date.now(),
      };
      const updatedConvo: ConvoState = {
        userId,
        turns: [...(convo?.turns ?? []), newTurn, replyTurn],
        updatedAt: Date.now(),
      };
      await deps.memory.setConvo(updatedConvo);
      await deps.memory.setProposal(proposal);
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
