import type { Hex } from '@agentvault/types';

export interface ParsedProposal {
  tokenIn: Hex;
  tokenOut: Hex;
  amountIn: string;
  maxSlippageBps: number;
  reasoning: string;
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

function isAddr(s: unknown): s is Hex {
  return typeof s === 'string' && ADDR_RE.test(s);
}

function stripFences(s: string): string {
  // Strip ```json ... ``` if model added fences despite instructions.
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export function parseProposal(raw: string): ParsedProposal {
  const cleaned = stripFences(raw);
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`twin output not JSON: ${(e as Error).message}`);
  }
  if (!obj || typeof obj !== 'object') throw new Error('proposal not an object');
  const o = obj as Record<string, unknown>;
  if (!isAddr(o.tokenIn)) throw new Error('tokenIn invalid address');
  if (!isAddr(o.tokenOut)) throw new Error('tokenOut invalid address');
  if (typeof o.amountIn !== 'string' || !/^\d+$/.test(o.amountIn)) {
    throw new Error('amountIn must be integer string');
  }
  if (typeof o.maxSlippageBps !== 'number' || o.maxSlippageBps <= 0 || o.maxSlippageBps > 1000) {
    throw new Error('maxSlippageBps out of range');
  }
  if (typeof o.reasoning !== 'string' || !o.reasoning.trim()) {
    throw new Error('reasoning required');
  }
  return {
    tokenIn: o.tokenIn,
    tokenOut: o.tokenOut,
    amountIn: o.amountIn,
    maxSlippageBps: o.maxSlippageBps,
    reasoning: o.reasoning,
  };
}

export interface ParsedSanity {
  ok: boolean;
  reason: string;
}

export function parseSanity(raw: string): ParsedSanity {
  const cleaned = stripFences(raw);
  const o = JSON.parse(cleaned) as Record<string, unknown>;
  if (typeof o.ok !== 'boolean') throw new Error('sanity.ok missing');
  return { ok: o.ok, reason: typeof o.reason === 'string' ? o.reason : '' };
}
