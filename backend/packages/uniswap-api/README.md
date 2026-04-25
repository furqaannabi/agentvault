# @agentvault/uniswap-api

Typed wrapper for the Uniswap Trade API used by the real execution adapter.

## Sample

```ts
import { createUniswapApiClient } from '@agentvault/uniswap-api';

const uniswap = createUniswapApiClient({
  apiKey: process.env.UNISWAP_API_KEY ?? '',
});

const approval = await uniswap.checkApproval({
  walletAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  amount: '1000000000',
  chainId: 1,
});

const quote = await uniswap.quote({
  type: 'EXACT_INPUT',
  amount: '1000000000',
  tokenInChainId: 1,
  tokenOutChainId: 1,
  tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  swapper: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  slippageTolerance: 0.5,
});

const swap = await uniswap.swap({
  quote,
  simulateTransaction: true,
});

void approval;
void swap;
```

The `/swap` request needs the quote returned by `/quote`. If the quote includes Permit2 data, sign it first and pass the resulting signature to `swap`.
