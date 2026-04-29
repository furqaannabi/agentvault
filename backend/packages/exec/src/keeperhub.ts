import {
  ERC20_APPROVE_ABI,
  type KeeperhubClientConfig,
  UNIVERSAL_ROUTER_SEPOLIA,
  createKeeperhubClient,
} from '@agentvault/keeperhub';
import type {
  ExecAdapter,
  ExecResult,
  ExecStageEvent,
  ExecSwapInput,
  Hex,
  KeeperhubExecution,
} from '@agentvault/types';
import { createUniswapApiClient } from '@agentvault/uniswap-api';
import { ethers } from 'ethers';
import type { ExecConfig } from './index.js';

/**
 * KeeperHub-routed exec adapter.
 *
 * Flow per swap (every gas-bearing onchain write goes through KeeperHub):
 *   1. Pull funds from user (ERC20.transferFrom) — direct ethers, since the
 *      user's allowance was granted to *our* delegate, not KH's Turnkey.
 *   2. Run Uniswap Trade API: /check_approval, /quote, sign Permit2 with our wallet.
 *   3. If Trade API returns a Permit2 approval tx, decode and route through
 *      KH executeApproval (KH wallet signs/broadcasts).
 *   4. Hand swap calldata to KH executeSwap. KH retries on transient failures.
 *   5. Once KH reports terminal status, fetch the receipt with our RPC to
 *      parse amountOut from ERC20 Transfer logs.
 *   6. Forward output to end user via direct ethers transfer.
 *
 * Receipts from steps 3 + 4 are accumulated into ExecResult.keeperhubReceipts
 * (transient) so the route can lift them to Proof.keeperhubReceipts.
 *
 * Sepolia only — chain guard inside keeperhub client + here at boot.
 */

const ZERO_HASH: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';
const SEPOLIA_CHAIN_ID = 11155111;
const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_RUNTIME_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

interface ApprovalResponse {
  approval?: { to: Hex; data: Hex; value?: string } | null;
}

interface QuoteResponse {
  quote: unknown;
  permitData?: {
    domain: ethers.TypedDataDomain;
    types: Record<string, ethers.TypedDataField[]>;
    values: Record<string, unknown>;
  } | null;
  output?: { amount?: string };
}

interface SwapResponse {
  transaction: {
    to: Hex;
    data: Hex;
    value?: string;
    from?: Hex;
    chainId?: number;
    gasLimit?: string;
  };
  requestId?: string;
}

export interface KeeperhubAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  network: string;
  chainId: number;
  timeoutMs?: number;
  fallbackToDirect?: boolean;
  routerAddress?: Hex;
  /** Internal hook — tests inject custom fetch into the underlying client. */
  fetch?: KeeperhubClientConfig['fetch'];
  dashboardUrl?: string;
}

/** Decode an ERC20 approve(spender, amount) calldata into its args. */
function decodeApprovalCalldata(data: Hex): { spender: Hex; amount: string } {
  const iface = new ethers.Interface(ERC20_APPROVE_ABI);
  const parsed = iface.parseTransaction({ data });
  if (!parsed || parsed.name !== 'approve') {
    throw new Error(
      `[exec.keeperhub] expected ERC20.approve calldata, got ${parsed?.name ?? 'unknown'}`,
    );
  }
  const [spender, amount] = parsed.args as unknown as [string, bigint];
  return { spender: spender as Hex, amount: amount.toString() };
}

/** Safely emit a stage event — never lets a faulty consumer crash the adapter. */
function emitStage(cb: ExecSwapInput['onStage'], event: ExecStageEvent): void {
  if (!cb) return;
  try {
    cb(event);
  } catch (e) {
    console.warn('[exec.keeperhub] onStage callback threw:', (e as Error).message);
  }
}

export function keeperhubAdapter(
  config: ExecConfig,
  kh: KeeperhubAdapterConfig,
): ExecAdapter {
  const apiKey = process.env.UNISWAP_API_KEY ?? '';
  if (kh.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `[exec.keeperhub] chainId ${kh.chainId} ≠ Sepolia (${SEPOLIA_CHAIN_ID}); refused`,
    );
  }
  if (!config.sepoliaPrivateKey) throw new Error('SEPOLIA_PRIVATE_KEY required for keeperhub mode');
  if (!config.sepoliaRpcUrl) throw new Error('SEPOLIA_RPC_URL required for keeperhub mode');
  if (!apiKey) throw new Error('UNISWAP_API_KEY required for keeperhub mode');
  if (!kh.apiKey) throw new Error('KEEPERHUB_API_KEY required for keeperhub mode');

  const provider = new ethers.JsonRpcProvider(config.sepoliaRpcUrl);
  const wallet = new ethers.Wallet(config.sepoliaPrivateKey, provider);
  const uniswap = createUniswapApiClient({ apiKey });
  const keeperhub = createKeeperhubClient({
    apiKey: kh.apiKey,
    baseUrl: kh.baseUrl,
    network: kh.network,
    chainId: kh.chainId,
    timeoutMs: kh.timeoutMs,
    fetch: kh.fetch,
    dashboardUrl: kh.dashboardUrl,
  });
  const router = kh.routerAddress ?? UNIVERSAL_ROUTER_SEPOLIA;
  const fallbackToDirect = kh.fallbackToDirect ?? false;
  const cache = new Map<string, ExecResult>();

  return {
    async swap({
      proposal,
      verdict,
      user,
      demoOverrides,
      onStage,
    }: ExecSwapInput): Promise<ExecResult> {
      const cached = cache.get(proposal.id);
      if (cached) return cached;

      const receipts: KeeperhubExecution[] = [];

      const fail = (
        status: 'failed' | 'reverted',
        error: string,
        partial?: Partial<ExecResult>,
      ): ExecResult => {
        const r: ExecResult = {
          proposalId: proposal.id,
          txHash: ZERO_HASH,
          blockNumber: 0,
          amountOut: '0',
          gasUsed: '0',
          status,
          error,
          chainId: SEPOLIA_CHAIN_ID,
          keeperhubReceipts: receipts.length > 0 ? receipts : undefined,
          ...partial,
        };
        emitStage(onStage, { stage: 'FAILED', payload: { error, status } });
        cache.set(proposal.id, r);
        return r;
      };

      if (!verdict.ok) return fail('failed', 'verdict.ok=false');

      try {
        const swapper = wallet.address as Hex;
        const amountInBig = BigInt(proposal.amountIn);
        // biome-ignore lint/suspicious/noExplicitAny: ethers Contract method types are dynamic
        const tokenIn: any = new ethers.Contract(proposal.tokenIn, ERC20_RUNTIME_ABI, wallet);
        // biome-ignore lint/suspicious/noExplicitAny: ethers Contract method types are dynamic
        const tokenOut: any = new ethers.Contract(proposal.tokenOut, ERC20_RUNTIME_ABI, wallet);

        const allowance: bigint = await tokenIn.allowance(user, swapper);
        if (allowance < amountInBig) {
          return fail(
            'failed',
            `allowance ${allowance} < amountIn ${amountInBig}; user must re-approve token ${proposal.tokenIn}`,
          );
        }

        const pullTx = await tokenIn.transferFrom(user, swapper, amountInBig);
        const pullR = await pullTx.wait();
        if (!pullR || pullR.status !== 1) return fail('failed', 'transferFrom user failed');

        const approvalRes = await uniswap.checkApproval<ApprovalResponse>({
          walletAddress: swapper,
          token: proposal.tokenIn,
          amount: proposal.amountIn,
          chainId: SEPOLIA_CHAIN_ID,
        });

        // Step 3: route Permit2 approval through KeeperHub (Item 1).
        if (approvalRes.approval) {
          let spender: Hex;
          let amount: string;
          try {
            ({ spender, amount } = decodeApprovalCalldata(approvalRes.approval.data));
          } catch (e) {
            return fail('failed', `failed to decode approval calldata: ${(e as Error).message}`);
          }

          emitStage(onStage, {
            stage: 'SUBMITTING',
            step: 'approval',
            payload: { tokenAddress: approvalRes.approval.to, spender, amount },
          });

          let approvalKh: Awaited<ReturnType<typeof keeperhub.executeApproval>>;
          try {
            approvalKh = await keeperhub.executeApproval({
              tokenAddress: approvalRes.approval.to,
              spender,
              amount,
            });
          } catch (e) {
            if (fallbackToDirect) {
              console.warn(
                '[exec.keeperhub] approval submit failed; falling back to direct send:',
                (e as Error).message,
              );
              const tx = await wallet.sendTransaction({
                to: approvalRes.approval.to,
                data: approvalRes.approval.data,
                value: approvalRes.approval.value ? BigInt(approvalRes.approval.value) : 0n,
              });
              const r = await tx.wait();
              if (!r || r.status !== 1) return fail('failed', 'approval (fallback) tx failed');
            } else {
              return fail('failed', `keeperhub approval submit failed: ${(e as Error).message}`);
            }
          }
          // biome-ignore lint/suspicious/noExplicitAny: declared via try/catch above
          const ak = approvalKh!;
          if (ak) {
            const approvalReceipt: KeeperhubExecution = {
              kind: 'approval',
              jobId: ak.jobId,
              auditTrailUrl: ak.auditTrailUrl,
              attempts: ak.attempts,
              finalTxHash: ak.finalTxHash,
              finalGasUsed: ak.finalGasUsed,
              status: ak.status,
              network: 'sepolia',
              ...(ak.error ? { error: ak.error } : {}),
            };
            receipts.push(approvalReceipt);
            emitStage(onStage, {
              stage: 'BROADCAST',
              step: 'approval',
              payload: { jobId: ak.jobId, txHash: ak.finalTxHash, attempts: ak.attempts },
            });
            if (ak.status !== 'success') {
              return fail(
                ak.status === 'failed' ? 'reverted' : 'failed',
                `keeperhub approval ${ak.status}: ${ak.error ?? 'see audit trail'}`,
              );
            }
          }
        }

        const quoteRes = await uniswap.quoteProposal<QuoteResponse>(
          proposal,
          SEPOLIA_CHAIN_ID,
          swapper,
        );

        let signature: Hex | undefined;
        if (quoteRes.permitData) {
          const { domain, types, values } = quoteRes.permitData;
          const filtered = { ...types } as Record<string, ethers.TypedDataField[]> & {
            EIP712Domain?: ethers.TypedDataField[];
          };
          delete filtered.EIP712Domain;
          signature = (await wallet.signTypedData(domain, filtered, values)) as Hex;
        }

        const swapRes = (await uniswap.swap({
          quote: quoteRes.quote,
          signature,
          permitData: quoteRes.permitData ?? undefined,
        })) as Record<string, unknown>;
        const tx0 =
          (swapRes.transaction as SwapResponse['transaction'] | undefined) ??
          (swapRes.swap as SwapResponse['transaction'] | undefined);
        if (!tx0) {
          return fail('failed', `swap response missing transaction: ${JSON.stringify(swapRes).slice(0, 200)}`);
        }

        const routerAddress = (tx0.to ?? router) as Hex;
        const value = tx0.value ? BigInt(tx0.value) : 0n;

        // Step 4: route Universal Router execute() through KeeperHub.
        // demoOverrides.gasLimitMultiplier (Item 4) lets us force a real KH retry.
        emitStage(onStage, {
          stage: 'SUBMITTING',
          step: 'swap',
          payload: { routerAddress, gasLimitMultiplier: demoOverrides?.gasLimitMultiplier },
        });

        let swapKh: Awaited<ReturnType<typeof keeperhub.executeSwap>>;
        try {
          swapKh = await keeperhub.executeSwap({
            routerAddress,
            calldata: tx0.data,
            value,
            gasLimitMultiplier: demoOverrides?.gasLimitMultiplier,
          });
        } catch (e) {
          if (fallbackToDirect) {
            console.warn(
              '[exec.keeperhub] swap submit failed; falling back to direct send:',
              (e as Error).message,
            );
            return await directFallback(routerAddress, tx0.data, value);
          }
          return fail('failed', `keeperhub swap submit failed: ${(e as Error).message}`);
        }

        const swapReceipt: KeeperhubExecution = {
          kind: 'swap',
          jobId: swapKh.jobId,
          auditTrailUrl: swapKh.auditTrailUrl,
          attempts: swapKh.attempts,
          finalTxHash: swapKh.finalTxHash,
          finalGasUsed: swapKh.finalGasUsed,
          status: swapKh.status,
          network: 'sepolia',
          ...(swapKh.error ? { error: swapKh.error } : {}),
        };
        receipts.push(swapReceipt);

        emitStage(onStage, {
          stage: 'BROADCAST',
          step: 'swap',
          payload: { jobId: swapKh.jobId, txHash: swapKh.finalTxHash, attempts: swapKh.attempts },
        });

        if (swapKh.status !== 'success') {
          return fail(
            swapKh.status === 'failed' ? 'reverted' : 'failed',
            `keeperhub swap ${swapKh.status}: ${swapKh.error ?? 'see audit trail'}`,
            { keeperhub: swapReceipt },
          );
        }

        emitStage(onStage, {
          stage: 'CONFIRMING',
          step: 'swap',
          payload: { txHash: swapKh.finalTxHash },
        });

        // KH broadcast succeeded. Fetch receipt locally to parse logs.
        const receipt = await provider.getTransactionReceipt(swapKh.finalTxHash);
        if (!receipt) {
          return fail(
            'failed',
            `keeperhub reported success but no receipt for ${swapKh.finalTxHash}`,
            { keeperhub: swapReceipt },
          );
        }
        if (receipt.status !== 1) {
          return fail('reverted', `tx reverted at block ${receipt.blockNumber}`, {
            keeperhub: swapReceipt,
          });
        }

        const tokenOutLc = proposal.tokenOut.toLowerCase();
        const swapperPadded =
          `0x${'0'.repeat(24)}${swapper.slice(2).toLowerCase()}`.toLowerCase();
        let amountOut = 0n;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== tokenOutLc) continue;
          if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC.toLowerCase()) continue;
          if (log.topics[2]?.toLowerCase() !== swapperPadded) continue;
          amountOut += BigInt(log.data);
        }
        if (amountOut === 0n && quoteRes.output?.amount) {
          amountOut = BigInt(quoteRes.output.amount);
        }

        if (amountOut > 0n) {
          const forwardTx = await tokenOut.transfer(user, amountOut);
          const forwardR = await forwardTx.wait();
          if (!forwardR || forwardR.status !== 1) {
            return fail(
              'failed',
              `swap ok but transfer to user failed (amount=${amountOut})`,
              { keeperhub: swapReceipt },
            );
          }
        }

        const result: ExecResult = {
          proposalId: proposal.id,
          txHash: receipt.hash as Hex,
          blockNumber: Number(receipt.blockNumber),
          amountOut: amountOut.toString(),
          gasUsed: receipt.gasUsed.toString(),
          status: 'success',
          chainId: SEPOLIA_CHAIN_ID,
          keeperhub: swapReceipt,
          keeperhubReceipts: receipts,
        };
        emitStage(onStage, {
          stage: 'SETTLED',
          payload: {
            txHash: receipt.hash,
            blockNumber: Number(receipt.blockNumber),
            amountOut: amountOut.toString(),
            attempts: swapKh.attempts,
          },
        });
        cache.set(proposal.id, result);
        return result;
      } catch (e) {
        return fail('failed', (e as Error).message);
      }

      // Internal direct-fallback shim used only when KEEPERHUB_FALLBACK=true and
      // the *submission* to KeeperHub itself fails. Keeps the demo alive when
      // KeeperHub is down. No keeperhub receipts attached, so verifiers can
      // detect this trade did not flow through the KeeperHub layer.
      async function directFallback(
        to: Hex,
        data: Hex,
        value: bigint,
      ): Promise<ExecResult> {
        const tx = await wallet.sendTransaction({ to, data, value });
        const r = await tx.wait();
        if (!r) return fail('failed', 'direct fallback: no receipt');
        if (r.status !== 1) {
          return fail('reverted', `direct fallback: tx reverted at block ${r.blockNumber}`);
        }
        const result: ExecResult = {
          proposalId: proposal.id,
          txHash: r.hash as Hex,
          blockNumber: Number(r.blockNumber),
          amountOut: '0',
          gasUsed: r.gasUsed.toString(),
          status: 'success',
          chainId: SEPOLIA_CHAIN_ID,
        };
        cache.set(proposal.id, result);
        return result;
      }
    },
  };
}
