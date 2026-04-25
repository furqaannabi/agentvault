import type { Hex, TradeProposal } from '@agentvault/types';

export interface UniswapApiConfig {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  permit2Disabled?: boolean;
  universalRouterVersion?: '1.2' | '2.0' | '2.1';
  erc20EthEnabled?: boolean;
}

export type UniswapRoutingPreference = 'BEST_PRICE' | 'FASTEST';
export type UniswapUrgency = 'normal' | 'fast' | 'urgent';

export interface UniswapQuoteRequest {
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  amount: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  tokenIn: Hex;
  tokenOut: Hex;
  swapper: Hex;
  slippageTolerance?: number;
  routingPreference?: UniswapRoutingPreference;
  generatePermitAsTransaction?: boolean;
}

export interface UniswapCheckApprovalRequest {
  walletAddress: Hex;
  token: Hex;
  amount: string;
  chainId: number;
  urgency?: UniswapUrgency;
  includeGasInfo?: boolean;
  tokenOut?: Hex;
  tokenOutChainId?: number;
}

export interface UniswapSwapRequest<TQuote = unknown> {
  quote: TQuote;
  signature?: Hex;
  permitData?: unknown;
  refreshGasPrice?: boolean;
  simulateTransaction?: boolean;
  deadline?: number;
  urgency?: UniswapUrgency;
}

export type UniswapApiResponse<T> = T & {
  requestId?: string;
};

export interface UniswapApiClient {
  checkApproval<TResponse = unknown>(
    request: UniswapCheckApprovalRequest,
  ): Promise<UniswapApiResponse<TResponse>>;
  quote<TResponse = unknown>(
    request: UniswapQuoteRequest,
  ): Promise<UniswapApiResponse<TResponse>>;
  swap<TResponse = unknown, TQuote = unknown>(
    request: UniswapSwapRequest<TQuote>,
  ): Promise<UniswapApiResponse<TResponse>>;
  quoteProposal<TResponse = unknown>(
    proposal: TradeProposal,
    chainId: number,
    swapper: Hex,
  ): Promise<UniswapApiResponse<TResponse>>;
}

const DEFAULT_UNISWAP_API_BASE_URL = 'https://trade-api.gateway.uniswap.org/v1';

export function createUniswapApiClient(config: UniswapApiConfig): UniswapApiClient {
  const baseUrl = config.baseUrl ?? DEFAULT_UNISWAP_API_BASE_URL;
  const fetchImpl = config.fetch ?? fetch;

  async function post<TResponse>(
    path: string,
    body: UniswapCheckApprovalRequest | UniswapQuoteRequest | UniswapSwapRequest,
  ): Promise<UniswapApiResponse<TResponse>> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'x-erc20eth-enabled': String(config.erc20EthEnabled ?? false),
        'x-permit2-disabled': String(config.permit2Disabled ?? false),
        'x-universal-router-version': config.universalRouterVersion ?? '2.0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[uniswap] ${path} failed ${response.status}: ${text}`);
      console.error(`[uniswap] ${path} sent body:`, JSON.stringify(body));
      throw new Error(
        `Uniswap API ${path} ${response.status}: ${text || response.statusText}`,
      );
    }

    return (await response.json()) as UniswapApiResponse<TResponse>;
  }

  return {
    checkApproval: (request) => post('/check_approval', request),
    quote: (request) => post('/quote', request),
    swap: (request) => post('/swap', request),
    quoteProposal: (proposal, chainId, swapper) =>
      post('/quote', {
        type: 'EXACT_INPUT',
        amount: proposal.amountIn,
        tokenInChainId: chainId,
        tokenOutChainId: chainId,
        tokenIn: proposal.tokenIn,
        tokenOut: proposal.tokenOut,
        swapper,
        slippageTolerance: proposal.maxSlippageBps / 100,
      }),
  };
}
