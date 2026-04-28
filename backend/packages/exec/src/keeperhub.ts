import {
  type KeeperhubClientConfig,
  UNIVERSAL_ROUTER_SEPOLIA,
  createKeeperhubClient,
} from '@agentvault/keeperhub';
import type { ExecAdapter, ExecResult, ExecSwapInput, Hex } from '@agentvault/types';
import { createUniswapApiClient } from '@agentvault/uniswap-api';
import { ethers } from 'ethers';
import type { ExecConfig } from './index.js';

/**
 * KeeperHub-routed exec adapter.
 *
 * Flow per swap:
 *   1. Pull funds from user (ERC20.transferFrom) — direct, our wallet must hold input tokens.
 *   2. Run Uniswap Trade API: /check_approval, /quote, sign Permit2 with our wallet.
 *   3. Get swap calldata for Universal Router from /swap.
 *   4. Hand calldata + router address to KeeperHub's contract-call API.
 *      KeeperHub signs + broadcasts via its Turnkey wallet, retrying on revert/gas.
 *   5. Once KeeperHub reports terminal status, fetch the receipt with our RPC to
 *      parse amountOut from ERC20 Transfer logs (KH does not return decoded logs).
 *   6. Forward output to end user.
 *
 * If steps 1-3 succeed but step 4 fails to even submit, optionally fall back
 * to direct send when KEEPERHUB_FALLBACK=true (config.keeperhub.fallbackToDirect).
 *
 * Sepolia only — chain guard inside keeperhub client + here at boot.
 */

const ZERO_HASH: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';
const SEPOLIA_CHAIN_ID = 11155111;
const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_ABI = [
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
    async swap({ proposal, verdict, user }: ExecSwapInput): Promise<ExecResult> {
      const cached = cache.get(proposal.id);
      if (cached) return cached;

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
          ...partial,
        };
        cache.set(proposal.id, r);
        return r;
      };

      if (!verdict.ok) return fail('failed', 'verdict.ok=false');

      try {
        const swapper = wallet.address as Hex;
        const amountInBig = BigInt(proposal.amountIn);
        // biome-ignore lint/suspicious/noExplicitAny: ethers Contract method types are dynamic
        const tokenIn: any = new ethers.Contract(proposal.tokenIn, ERC20_ABI, wallet);
        // biome-ignore lint/suspicious/noExplicitAny: ethers Contract method types are dynamic
        const tokenOut: any = new ethers.Contract(proposal.tokenOut, ERC20_ABI, wallet);

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
        if (approvalRes.approval) {
          const approvalTx = await wallet.sendTransaction({
            to: approvalRes.approval.to,
            data: approvalRes.approval.data,
            value: approvalRes.approval.value ? BigInt(approvalRes.approval.value) : 0n,
          });
          const ar = await approvalTx.wait();
          if (!ar || ar.status !== 1) return fail('failed', 'approval tx failed');
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

        // Hand swap calldata to KeeperHub for guaranteed execution + retries.
        // If submission itself fails (network/auth) and fallbackToDirect=true,
        // fall through to a plain ethers send so the demo doesn't crash.
        let kh: Awaited<ReturnType<typeof keeperhub.executeSwap>>;
        try {
          kh = await keeperhub.executeSwap({
            routerAddress,
            calldata: tx0.data,
            value,
          });
        } catch (e) {
          if (fallbackToDirect) {
            console.warn(
              '[exec.keeperhub] submit failed; falling back to direct send:',
              (e as Error).message,
            );
            return await directFallback(routerAddress, tx0.data, value);
          }
          return fail('failed', `keeperhub submit failed: ${(e as Error).message}`);
        }

        // Build the keeperhub block we'll embed in ExecResult regardless of outcome.
        const khBlock = {
          jobId: kh.jobId,
          auditTrailUrl: kh.auditTrailUrl,
          attempts: kh.attempts,
          finalTxHash: kh.finalTxHash,
          finalGasUsed: kh.finalGasUsed,
          status: kh.status,
          network: 'sepolia' as const,
          ...(kh.error ? { error: kh.error } : {}),
        };

        if (kh.status !== 'success') {
          return fail(
            kh.status === 'failed' ? 'reverted' : 'failed',
            `keeperhub ${kh.status}: ${kh.error ?? 'see audit trail'}`,
            { keeperhub: khBlock },
          );
        }

        // KeeperHub broadcast succeeded. Fetch receipt locally to parse logs.
        const receipt = await provider.getTransactionReceipt(kh.finalTxHash);
        if (!receipt) {
          return fail(
            'failed',
            `keeperhub reported success but no receipt for ${kh.finalTxHash}`,
            { keeperhub: khBlock },
          );
        }
        if (receipt.status !== 1) {
          return fail('reverted', `tx reverted at block ${receipt.blockNumber}`, {
            keeperhub: khBlock,
          });
        }

        // KeeperHub broadcasts from its own wallet — Universal Router calldata
        // typically includes a recipient command targeting our `swapper`, so the
        // tokenOut Transfer log lands at our wallet address.
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
              { keeperhub: khBlock },
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
          keeperhub: khBlock,
        };
        cache.set(proposal.id, result);
        return result;
      } catch (e) {
        return fail('failed', (e as Error).message);
      }

      // Internal direct-fallback shim used only when KEEPERHUB_FALLBACK=true and
      // the *submission* to KeeperHub itself fails. Keeps the demo alive when
      // KeeperHub is down. The proof's keeperhub block is intentionally omitted
      // so verifiers can detect that this trade did not actually flow through
      // the KeeperHub layer.
      async function directFallback(
        to: Hex,
        data: Hex,
        value: bigint,
      ): Promise<ExecResult> {
        const tx = await wallet.sendTransaction({ to, data, value });
        const receipt = await tx.wait();
        if (!receipt) return fail('failed', 'direct fallback: no receipt');
        if (receipt.status !== 1) {
          return fail('reverted', `direct fallback: tx reverted at block ${receipt.blockNumber}`);
        }
        const result: ExecResult = {
          proposalId: proposal.id,
          txHash: receipt.hash as Hex,
          blockNumber: Number(receipt.blockNumber),
          amountOut: '0',
          gasUsed: receipt.gasUsed.toString(),
          status: 'success',
          chainId: SEPOLIA_CHAIN_ID,
        };
        cache.set(proposal.id, result);
        return result;
      }
    },
  };
}
