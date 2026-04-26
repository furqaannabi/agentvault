import type { ExecAdapter, ExecResult, ExecSwapInput, Hex } from '@agentvault/types';
import { createUniswapApiClient } from '@agentvault/uniswap-api';
import { ethers } from 'ethers';
import type { ExecConfig } from './index.js';

/**
 * Real execution adapter using the Uniswap Trade API on an EVM testnet.
 * Default chain: Ethereum Sepolia (11155111). Override via EXEC_CHAIN_ID.
 *
 * Pipeline per swap:
 *   1. /check_approval → if approval tx returned, send it and wait
 *   2. /quote (via quoteProposal helper)
 *   3. If permitData present, sign EIP-712 typed data with our wallet
 *   4. /swap → returns transaction calldata
 *   5. wallet.sendTransaction → wait receipt
 *   6. Parse ERC20 Transfer logs (tokenOut → wallet) to compute amountOut
 *   7. Cache by proposal.id for idempotency
 */
const ZERO_HASH: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';
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

export function realAdapter(config: ExecConfig): ExecAdapter {
  const apiKey = process.env.UNISWAP_API_KEY ?? '';
  const chainId = Number(process.env.EXEC_CHAIN_ID ?? 11155111);

  if (!config.sepoliaPrivateKey) {
    throw new Error('SEPOLIA_PRIVATE_KEY required when EXEC_MODE=real');
  }
  if (!config.sepoliaRpcUrl) {
    throw new Error('SEPOLIA_RPC_URL required when EXEC_MODE=real');
  }
  if (!apiKey) {
    throw new Error('UNISWAP_API_KEY required when EXEC_MODE=real');
  }

  const provider = new ethers.JsonRpcProvider(config.sepoliaRpcUrl);
  const wallet = new ethers.Wallet(config.sepoliaPrivateKey, provider);
  const uniswap = createUniswapApiClient({ apiKey });
  const cache = new Map<string, ExecResult>();

  return {
    async swap({ proposal, verdict, user }: ExecSwapInput): Promise<ExecResult> {
      const cached = cache.get(proposal.id);
      if (cached) return cached;

      const fail = (status: 'failed' | 'reverted', error: string): ExecResult => {
        const r: ExecResult = {
          proposalId: proposal.id,
          txHash: ZERO_HASH,
          blockNumber: 0,
          amountOut: '0',
          gasUsed: '0',
          status,
          error,
          chainId,
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

        // 0a. Allowance check
        const allowance: bigint = await tokenIn.allowance(user, swapper);
        if (allowance < amountInBig) {
          return fail(
            'failed',
            `allowance ${allowance} < amountIn ${amountInBig}; user must re-approve token ${proposal.tokenIn}`,
          );
        }

        // 0b. Pull funds from user → backend signer
        const pullTx = await tokenIn.transferFrom(user, swapper, amountInBig);
        const pullR = await pullTx.wait();
        if (!pullR || pullR.status !== 1) return fail('failed', 'transferFrom user failed');

        // 1. Check approval — Uniswap returns an approval tx if Permit2 isn't approved on tokenIn
        const approvalRes = await uniswap.checkApproval<ApprovalResponse>({
          walletAddress: swapper,
          token: proposal.tokenIn,
          amount: proposal.amountIn,
          chainId,
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

        // 2. Quote
        const quoteRes = await uniswap.quoteProposal<QuoteResponse>(proposal, chainId, swapper);

        // 3. Optional Permit2 EIP-712 signature
        let signature: Hex | undefined;
        if (quoteRes.permitData) {
          const { domain, types, values } = quoteRes.permitData;
          // ethers.signTypedData rejects EIP712Domain in types
          const filtered = { ...types } as Record<string, ethers.TypedDataField[]> & {
            EIP712Domain?: ethers.TypedDataField[];
          };
          delete filtered.EIP712Domain;
          signature = (await wallet.signTypedData(domain, filtered, values)) as Hex;
        }

        // 4. Swap calldata — Uniswap requires permitData alongside signature
        const swapRes = (await uniswap.swap({
          quote: quoteRes.quote,
          signature,
          permitData: quoteRes.permitData ?? undefined,
        })) as Record<string, unknown>;
        console.log('[exec] swap response keys:', Object.keys(swapRes));
        console.log('[exec] swap response sample:', JSON.stringify(swapRes).slice(0, 500));

        // Uniswap Trade API may return tx under .transaction or .swap
        const tx0 =
          (swapRes.transaction as SwapResponse['transaction'] | undefined) ??
          (swapRes.swap as SwapResponse['transaction'] | undefined);
        if (!tx0) {
          return fail('failed', `swap response missing transaction: ${JSON.stringify(swapRes).slice(0, 200)}`);
        }

        // 5. Send tx
        const tx = await wallet.sendTransaction({
          to: tx0.to,
          data: tx0.data,
          value: tx0.value ? BigInt(tx0.value) : 0n,
          gasLimit: tx0.gasLimit ? BigInt(tx0.gasLimit) : undefined,
        });
        const receipt = await tx.wait();
        if (!receipt) return fail('failed', 'no receipt');
        if (receipt.status !== 1) {
          return fail('reverted', `tx reverted at block ${receipt.blockNumber}`);
        }

        // 6. Parse amountOut from ERC20 Transfer logs (tokenOut → swapper)
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

        // 7. Forward output to end user
        if (amountOut > 0n) {
          const forwardTx = await tokenOut.transfer(user, amountOut);
          const forwardR = await forwardTx.wait();
          if (!forwardR || forwardR.status !== 1) {
            return fail('failed', `swap ok but transfer to user failed (amount=${amountOut})`);
          }
        }

        const result: ExecResult = {
          proposalId: proposal.id,
          txHash: receipt.hash as Hex,
          blockNumber: Number(receipt.blockNumber),
          amountOut: amountOut.toString(),
          gasUsed: receipt.gasUsed.toString(),
          status: 'success',
          chainId,
        };
        cache.set(proposal.id, result);
        return result;
      } catch (e) {
        return fail('failed', (e as Error).message);
      }
    },
  };
}
