export type Hex = `0x${string}`;

/**
 * Cryptographic record of one LLM call. BE1 signs the tuple
 * (providerUrl, modelId, promptHash, outputHash, ts) so any
 * verifier can re-fetch + check determinism + match hashes.
 */
export interface VerifiableInference {
  providerUrl: string;
  modelId: string;
  promptHash: Hex;
  outputHash: Hex;
  ts: number;
  ourSig: Hex;
  signer: Hex;
}

export interface TradeProposal {
  id: string;
  userId: string;
  action: 'swap';
  tokenIn: Hex;
  tokenOut: Hex;
  amountIn: string;
  maxSlippageBps: number;
  reasoning: string;
  inference: VerifiableInference;
  createdAt: number;
}

export interface RuleResult {
  id: 'maxSize' | 'slippageCap' | 'whitelist' | 'dailyCap' | 'cooldown';
  pass: boolean;
  detail?: string;
}

export interface PolicyVerdict {
  proposalId: string;
  ok: boolean;
  rules: RuleResult[];
  sanityInference: VerifiableInference;
  sig: Hex;
  signer: Hex;
  ts: number;
}

export type ExecStatus = 'success' | 'reverted' | 'failed';

export interface ExecResult {
  proposalId: string;
  txHash: Hex;
  blockNumber: number;
  amountOut: string;
  gasUsed: string;
  status: ExecStatus;
  error?: string;
  chainId: number;
}

export interface Proof {
  proposalId: string;
  /** End-user wallet that authorized this trade via signed AgentSession. */
  userAddr: Hex;
  /** EIP-712 hash of the AgentSession that authorized this trade. */
  sessionHash: Hex;
  proposal: TradeProposal;
  verdict: PolicyVerdict;
  exec: ExecResult;
  rootHash: Hex;
  anchorTx: Hex;
  anchorChainId: number;
  logCid: string;
  createdAt: number;
}

export interface PortfolioState {
  userId: string;
  balances: Record<string, string>;
  updatedAt: number;
}

export interface ConvoTurn {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export interface ConvoState {
  userId: string;
  turns: ConvoTurn[];
  updatedAt: number;
}

/**
 * Off-chain delegation: user signs an EIP-712 AgentSession granting the
 * backend signer (`delegate`) bounded authority to execute swaps on their
 * behalf. Bounds enforced by policy package on every proposal.
 */
export interface AgentSession {
  user: Hex;
  delegate: Hex;
  chainId: number;
  allowedTokens: Hex[];
  maxDailyVolumeUsd: number;
  maxTradeUsd: number;
  maxSlippageBps: number;
  cooldownSec: number;
  expiresAt: number;
  nonce: Hex;
}

export interface SignedSession {
  session: AgentSession;
  signature: Hex;
}

/** Modes for the exec package — BE1 dev runs mock; BE2 implements real */
export type ExecMode = 'mock' | 'real';

export interface ExecSwapInput {
  proposal: TradeProposal;
  verdict: PolicyVerdict;
  /** End-user wallet (delegating principal). Real adapter pulls via allowance + returns output here. */
  user: Hex;
}

export interface ExecAdapter {
  swap(input: ExecSwapInput): Promise<ExecResult>;
}
