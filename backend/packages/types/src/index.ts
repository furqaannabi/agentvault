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

/**
 * KeeperHub-managed execution lifecycle, surfaced into the Proof so verifiers
 * can audit the independent execution layer (retries, gas, audit trail).
 *
 * Lives at ExecResult.keeperhub when EXEC_MODE=keeperhub. Folded into rootHash
 * via canonical hashExec — proof binding without schema bifurcation.
 *
 * Only public, demo-safe fields. Never include the API key or any secret here.
 */
export interface KeeperhubExecution {
  jobId: string;
  auditTrailUrl: string;
  attempts: number;
  finalTxHash: Hex;
  finalGasUsed: string;
  status: 'success' | 'failed' | 'timeout';
  network: 'sepolia';
  error?: string;
}

export interface ExecResult {
  proposalId: string;
  txHash: Hex;
  blockNumber: number;
  amountOut: string;
  gasUsed: string;
  status: ExecStatus;
  error?: string;
  chainId: number;
  /** Present when EXEC_MODE=keeperhub. Optional for backward compat. */
  keeperhub?: KeeperhubExecution;
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

/**
 * Modes for the exec package.
 *  - mock      — synthetic ExecResult (BE1 dev / unit tests)
 *  - real      — direct ethers + Uniswap Trade API on Sepolia (fallback)
 *  - keeperhub — Uniswap quote/Permit2 on our side, final tx via KeeperHub
 *                Direct Execution API. Sepolia only. See PRD section 6.
 */
export type ExecMode = 'mock' | 'real' | 'keeperhub';

export interface ExecSwapInput {
  proposal: TradeProposal;
  verdict: PolicyVerdict;
  /** End-user wallet (delegating principal). Real adapter pulls via allowance + returns output here. */
  user: Hex;
}

export interface ExecAdapter {
  swap(input: ExecSwapInput): Promise<ExecResult>;
}
