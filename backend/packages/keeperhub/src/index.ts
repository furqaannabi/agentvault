import type { Hex } from '@agentvault/types';
import { ethers } from 'ethers';
import { ERC20_APPROVE_ABI, UNIVERSAL_ROUTER_EXECUTE_ABI } from './abi.js';
import type {
  ExecuteApprovalInput,
  ExecuteSwapInput,
  KeeperhubClientConfig,
  KhAwaitJobOptions,
  KhContractCallRequest,
  KhContractCallSubmitResponse,
  KhExecStatusResponse,
  KhJobResult,
  KhSubmitJobInput,
} from './types.js';

export type {
  ExecuteApprovalInput,
  ExecuteSwapInput,
  KeeperhubClientConfig,
  KhAwaitJobOptions,
  KhJobResult,
  KhSubmitJobInput,
} from './types.js';
export {
  ERC20_APPROVE_ABI,
  UNIVERSAL_ROUTER_EXECUTE_ABI,
  UNIVERSAL_ROUTER_SEPOLIA,
} from './abi.js';

const DEFAULT_BASE_URL = 'https://app.keeperhub.com';
const DEFAULT_DASHBOARD_URL = 'https://app.keeperhub.com';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INITIAL_INTERVAL_MS = 1_500;
const DEFAULT_MAX_INTERVAL_MS = 4_000;
const SEPOLIA_CHAIN_ID = 11155111;

/**
 * KeeperHub network slug for Ethereum Sepolia. Verified via GET /api/chains
 * (https://docs.keeperhub.com/api/chains) which lists Sepolia at chainId
 * 11155111. The slug surface used by /api/execute/* takes lowercase names
 * (e.g. "ethereum", "base", "polygon"), so "sepolia" is the canonical value.
 * The env var KEEPERHUB_NETWORK overrides this string at boot if a future
 * KeeperHub release renames the slug; chainId 11155111 remains the source
 * of truth for AgentVault's chain guard.
 */
export const KEEPERHUB_SEPOLIA_NETWORK_SLUG = 'sepolia';
const ZERO_TX_HASH: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface KeeperhubClient {
  /** Submit a contract-call execution. Throws if chainId guard fails. */
  submitJob(input: KhSubmitJobInput): Promise<KhContractCallSubmitResponse>;
  /** Poll status until terminal or timeout. Never throws on terminal failure — returns status='failed'/'timeout'. */
  awaitJob(executionId: string, opts?: KhAwaitJobOptions): Promise<KhJobResult>;
  /** Convenience: decode Universal Router calldata and route through KeeperHub. */
  executeSwap(input: ExecuteSwapInput, opts?: KhAwaitJobOptions): Promise<KhJobResult>;
  /**
   * Convenience: route an ERC20 `approve(spender, amount)` through KeeperHub.
   * Used for the Permit2 approval step that the Uniswap Trade API returns from
   * `/check_approval`. Decodes the approval calldata locally then submits via
   * `/api/execute/contract-call` so KH manages broadcast + retries.
   */
  executeApproval(input: ExecuteApprovalInput, opts?: KhAwaitJobOptions): Promise<KhJobResult>;
  readonly cfg: Required<Pick<KeeperhubClientConfig, 'baseUrl' | 'network' | 'chainId' | 'timeoutMs' | 'dashboardUrl'>>;
}

/**
 * Hard chainId guard. KeeperHub *might* accept a non-Sepolia network for the
 * same API key; this defense-in-depth check ensures AgentVault never sends
 * non-testnet traffic regardless of remote configuration drift.
 */
function assertSepolia(chainId: number): void {
  if (chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `[keeperhub] refused: chainId ${chainId} is not Ethereum Sepolia (${SEPOLIA_CHAIN_ID}); AgentVault is testnet-only`,
    );
  }
}

function defaultAuditUrl(dashboardUrl: string, executionId: string): string {
  const base = dashboardUrl.replace(/\/$/, '');
  return `${base}/executions/${encodeURIComponent(executionId)}`;
}

function asBigIntStr(v: bigint | string | undefined): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'bigint') return v.toString();
  return v;
}

export function createKeeperhubClient(config: KeeperhubClientConfig): KeeperhubClient {
  if (!config.apiKey) throw new Error('[keeperhub] apiKey required');
  assertSepolia(config.chainId);

  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const dashboardUrl = (config.dashboardUrl ?? DEFAULT_DASHBOARD_URL).replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = config.fetch ?? fetch;
  const network = config.network;
  const chainId = config.chainId;

  async function khFetch<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      signal,
      headers: {
        'content-type': 'application/json',
        // KeeperHub Direct Execution API requires X-API-Key per
        // https://docs.keeperhub.com/api/direct-execution#authentication.
        'x-api-key': config.apiKey,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`[keeperhub] ${path} ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async function submitJob(input: KhSubmitJobInput): Promise<KhContractCallSubmitResponse> {
    assertSepolia(chainId);

    const body: KhContractCallRequest = {
      contractAddress: input.contractAddress,
      network,
      functionName: input.functionName,
      functionArgs: JSON.stringify(input.functionArgs ?? [], (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
      abi: typeof input.abi === 'string' ? input.abi : JSON.stringify(input.abi),
    };
    const value = asBigIntStr(input.value);
    if (value !== undefined) body.value = value;
    if (input.gasLimitMultiplier) body.gasLimitMultiplier = input.gasLimitMultiplier;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await khFetch<KhContractCallSubmitResponse>(
        '/api/execute/contract-call',
        { method: 'POST', body: JSON.stringify(body) },
        ctrl.signal,
      );
    } finally {
      clearTimeout(t);
    }
  }

  async function awaitJob(executionId: string, opts: KhAwaitJobOptions = {}): Promise<KhJobResult> {
    const totalBudget = opts.timeoutMs ?? timeoutMs;
    const initialInterval = opts.initialIntervalMs ?? DEFAULT_INITIAL_INTERVAL_MS;
    const maxInterval = opts.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS;
    const buildAuditUrl = opts.auditTrailUrl ?? ((id: string) => defaultAuditUrl(dashboardUrl, id));

    const start = Date.now();
    let interval = initialInterval;
    let attempts = 0;
    let last: KhExecStatusResponse | null = null;

    while (Date.now() - start < totalBudget) {
      attempts += 1;
      try {
        last = await khFetch<KhExecStatusResponse>(
          `/api/execute/${encodeURIComponent(executionId)}/status`,
          { method: 'GET' },
        );
      } catch (e) {
        // Transient — continue polling until budget exhausts.
        if (Date.now() - start + interval >= totalBudget) {
          return {
            jobId: executionId,
            status: 'timeout',
            attempts,
            finalTxHash: ZERO_TX_HASH,
            finalGasUsed: '0',
            auditTrailUrl: buildAuditUrl(executionId),
            network: 'sepolia',
            error: (e as Error).message,
          };
        }
      }

      if (last && (last.status === 'completed' || last.status === 'failed')) {
        const ok = last.status === 'completed';
        return {
          jobId: executionId,
          status: ok ? 'success' : 'failed',
          attempts,
          finalTxHash: (last.transactionHash ?? ZERO_TX_HASH) as Hex,
          finalGasUsed: last.gasUsedWei ?? '0',
          auditTrailUrl: buildAuditUrl(executionId),
          network: 'sepolia',
          ...(ok ? {} : { error: last.error ?? 'execution failed' }),
        };
      }

      await new Promise((r) => setTimeout(r, interval));
      interval = Math.min(interval * 1.5, maxInterval);
    }

    return {
      jobId: executionId,
      status: 'timeout',
      attempts,
      finalTxHash: (last?.transactionHash ?? ZERO_TX_HASH) as Hex,
      finalGasUsed: last?.gasUsedWei ?? '0',
      auditTrailUrl: buildAuditUrl(executionId),
      network: 'sepolia',
      error: `polling timed out after ${totalBudget}ms`,
    };
  }

  async function executeSwap(input: ExecuteSwapInput, opts?: KhAwaitJobOptions): Promise<KhJobResult> {
    assertSepolia(chainId);

    const iface = new ethers.Interface(UNIVERSAL_ROUTER_EXECUTE_ABI);
    let parsed: ethers.TransactionDescription | null;
    try {
      parsed = iface.parseTransaction({ data: input.calldata, value: input.value ?? 0n });
    } catch (e) {
      throw new Error(
        `[keeperhub] failed to decode Universal Router calldata as execute(bytes,bytes[],uint256): ${(e as Error).message}`,
      );
    }
    if (!parsed || parsed.name !== 'execute') {
      throw new Error(
        `[keeperhub] calldata does not target Universal Router execute(); got ${parsed?.name ?? 'unknown'}`,
      );
    }

    const [commands, inputs, deadline] = parsed.args as unknown as [string, string[], bigint];

    // gasLimitMultiplier override is the entry point for the Item 4 demo
    // (?demo=force-retry sets it to '0.85' to provoke a real KH gas-bump retry).
    const submitted = await submitJob({
      contractAddress: input.routerAddress,
      functionName: 'execute',
      functionArgs: [commands, inputs, deadline.toString()],
      abi: UNIVERSAL_ROUTER_EXECUTE_ABI,
      value: input.value,
      gasLimitMultiplier: input.gasLimitMultiplier ?? '1.3',
    });

    return await awaitJob(submitted.executionId, opts);
  }

  async function executeApproval(
    input: ExecuteApprovalInput,
    opts?: KhAwaitJobOptions,
  ): Promise<KhJobResult> {
    assertSepolia(chainId);

    const submitted = await submitJob({
      contractAddress: input.tokenAddress,
      functionName: 'approve',
      functionArgs: [input.spender, input.amount],
      abi: ERC20_APPROVE_ABI,
      gasLimitMultiplier: input.gasLimitMultiplier ?? '1.2',
    });

    return await awaitJob(submitted.executionId, opts);
  }

  return {
    submitJob,
    awaitJob,
    executeSwap,
    executeApproval,
    cfg: { baseUrl, network, chainId, timeoutMs, dashboardUrl },
  };
}
