import type { Hex } from '@agentvault/types';

/**
 * KeeperHub Direct Execution API types — mirrors the public surface documented
 * at https://docs.keeperhub.com/api/direct-execution.
 *
 * All endpoints rooted at {baseUrl}/api/execute/* and authenticated with
 * `Authorization: Bearer ${apiKey}` (see /api/authentication). Network names
 * are slugs (e.g. "sepolia", "base-sepolia") — we hard-lock to "sepolia" for
 * AgentVault per PRD (chainId 11155111 only).
 */

export type KhDirectExecStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Request shape for POST /api/execute/contract-call.
 *
 * Per docs, functionArgs and abi are JSON-encoded *strings*, not objects.
 * The client serializes args/abi for callers.
 */
export interface KhContractCallRequest {
  contractAddress: Hex;
  network: string;
  functionName: string;
  functionArgs?: string;
  abi?: string;
  value?: string;
  gasLimitMultiplier?: string;
}

export interface KhContractCallSubmitResponse {
  executionId: string;
  status: KhDirectExecStatus;
}

/**
 * Response shape for GET /api/execute/{executionId}/status. KeeperHub returns
 * the final transaction hash, gas used (in wei), and a block-explorer link
 * once the execution reaches a terminal state.
 */
export interface KhExecStatusResponse {
  executionId: string;
  status: KhDirectExecStatus;
  type?: string;
  transactionHash?: Hex | null;
  transactionLink?: string | null;
  gasUsedWei?: string | null;
  result?: unknown;
  error?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface KhSubmitJobInput {
  contractAddress: Hex;
  functionName: string;
  functionArgs: unknown[];
  abi: ReadonlyArray<unknown> | string;
  value?: bigint | string;
  gasLimitMultiplier?: string;
}

export interface KhAwaitJobOptions {
  /** Total wall clock budget for the poll loop. Defaults to client.timeoutMs. */
  timeoutMs?: number;
  /** Initial poll interval. Defaults to 1500ms; exponential up to maxIntervalMs. */
  initialIntervalMs?: number;
  maxIntervalMs?: number;
  /** Override the auditTrailUrl format (defaults to {dashboardUrl}/runs/{id}). */
  auditTrailUrl?: (executionId: string) => string;
}

/**
 * Public result of a KeeperHub-routed execution. This is the data the exec
 * adapter folds into ExecResult.keeperhub on the proof. Never includes the
 * API key or anything that could leak credentials into a serialized proof.
 */
export interface KhJobResult {
  jobId: string;
  status: 'success' | 'failed' | 'timeout';
  attempts: number;
  finalTxHash: Hex;
  finalGasUsed: string;
  auditTrailUrl: string;
  network: 'sepolia';
  error?: string;
}

export interface KeeperhubClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Network slug accepted by KeeperHub. Must map to chainId 11155111. */
  network: string;
  /** EVM chainId. Hard-locked to 11155111 by guard at submission time. */
  chainId: number;
  timeoutMs?: number;
  /** Override fetch (used by tests). */
  fetch?: typeof fetch;
  /** Override dashboard URL used to build auditTrailUrl. */
  dashboardUrl?: string;
}

export interface ExecuteSwapInput {
  /** Universal Router address on the target chain. */
  routerAddress: Hex;
  /** Raw calldata returned by Uniswap Trade API /swap. */
  calldata: Hex;
  /** Native value to forward (wei). 0 for ERC-20→ERC-20 swaps. */
  value?: bigint | string;
}
