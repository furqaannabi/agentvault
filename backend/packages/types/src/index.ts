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
 * One entry per KeeperHub job; AgentVault routes both the Permit2 approval
 * and the Universal Router swap through KH, so a single trade typically
 * produces two receipts (kind: 'approval' and kind: 'swap'). Lifted to
 * Proof.keeperhubReceipts (top-level) so it forms its own leaf in rootHash:
 * `keccak(hp || hv || he || hk)`. See proof/hash.ts.
 *
 * Only public, demo-safe fields. Never include the API key or any secret here.
 */
export interface KeeperhubExecution {
  /** Discriminator: which onchain step this receipt covers. */
  kind: 'approval' | 'swap';
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
  /**
   * Back-compat alias for the swap-leg KeeperHub receipt. Mirrors the
   * `kind: 'swap'` entry in Proof.keeperhubReceipts. Existing FE code reads
   * this field directly; new code should prefer Proof.keeperhubReceipts.
   */
  keeperhub?: KeeperhubExecution;
  /**
   * Transient carrier — populated by the keeperhub adapter, consumed by the
   * /approve route which forwards the array into assembleProof and clears
   * this field before persistence (the canonical home is Proof, not exec).
   */
  keeperhubReceipts?: KeeperhubExecution[];
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
  /**
   * Ordered list of KeeperHub receipts (typically [approval, swap]). Forms
   * the 4th leaf of rootHash so KeeperHub becomes cryptographically part of
   * the proof, not just a URL. Empty/absent for non-keeperhub executions.
   */
  keeperhubReceipts?: KeeperhubExecution[];
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

/**
 * Lifecycle stages emitted via the optional `onStage` callback below. Drives
 * the SSE sub-progress strip on the FE during /approve. Stages are deterministic
 * for the keeperhub adapter; mock/real adapters synthesise a subset so the
 * FE behaviour is uniform regardless of EXEC_MODE.
 */
export type ExecStage =
  | 'POLICY_CHECK'
  | 'SUBMITTING'
  | 'BROADCAST'
  | 'CONFIRMING'
  | 'SETTLED'
  | 'FAILED';

export interface ExecStageEvent {
  stage: ExecStage;
  /** Optional sub-stage label (e.g. 'approval' vs 'swap'). */
  step?: 'approval' | 'swap';
  /** Free-form payload — txHash, jobId, attempts, error message, etc. */
  payload?: Record<string, unknown>;
}

export interface ExecSwapInput {
  proposal: TradeProposal;
  verdict: PolicyVerdict;
  /** End-user wallet (delegating principal). Real adapter pulls via allowance + returns output here. */
  user: Hex;
  /**
   * Demo-only overrides surfaced through query params (e.g. ?demo=force-retry).
   * Never set in production paths; the route layer parses the query and
   * forwards. See routes/approve.ts.
   */
  demoOverrides?: {
    /** Override KH gasLimitMultiplier (e.g. '0.85' to force a real KH retry). */
    gasLimitMultiplier?: string;
  };
  /**
   * Optional progress callback. Called synchronously from the adapter at each
   * lifecycle transition. Errors thrown inside the callback must not crash
   * the adapter — implementers wrap with try/catch.
   */
  onStage?: (event: ExecStageEvent) => void;
}

export interface ExecAdapter {
  swap(input: ExecSwapInput): Promise<ExecResult>;
}
