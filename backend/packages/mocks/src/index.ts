import type {
  ExecResult,
  Hex,
  PolicyVerdict,
  Proof,
  TradeProposal,
  VerifiableInference,
} from '@agentvault/types';

const ZERO_SIG: Hex =
  '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const ZERO_ADDR: Hex = '0x0000000000000000000000000000000000000000';
const ZERO_HASH: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Ethereum Sepolia (chainId 11155111) — Circle's USDC + canonical WETH (Uniswap Trade API has liquidity here)
export const USDC_SEPOLIA: Hex = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const WETH_SEPOLIA: Hex = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
export const SEPOLIA_CHAIN_ID = 11155111;

export const mockInference = (overrides: Partial<VerifiableInference> = {}): VerifiableInference => ({
  providerUrl: 'https://mock.0g-compute.local/v1/proxy',
  modelId: 'mock-llm-v1',
  promptHash: ZERO_HASH,
  outputHash: ZERO_HASH,
  ts: Date.now(),
  ourSig: ZERO_SIG,
  signer: ZERO_ADDR,
  ...overrides,
});

export const mockProposal = (overrides: Partial<TradeProposal> = {}): TradeProposal => ({
  id: 'prop_mock_001',
  userId: 'user_mock_alice',
  action: 'swap',
  tokenIn: USDC_SEPOLIA,
  tokenOut: WETH_SEPOLIA,
  amountIn: '500000000', // 500 USDC (6 decimals)
  maxSlippageBps: 50,
  reasoning:
    'Portfolio is 80% stablecoins; target allocation is 60%. Swap 500 USDC into ETH to rebalance.',
  inference: mockInference(),
  createdAt: Date.now(),
  ...overrides,
});

export const mockVerdict = (overrides: Partial<PolicyVerdict> = {}): PolicyVerdict => ({
  proposalId: 'prop_mock_001',
  ok: true,
  rules: [
    { id: 'maxSize', pass: true },
    { id: 'slippageCap', pass: true },
    { id: 'whitelist', pass: true },
    { id: 'dailyCap', pass: true },
    { id: 'cooldown', pass: true },
  ],
  sanityInference: mockInference({ modelId: 'mock-llm-sanity' }),
  sig: ZERO_SIG,
  signer: ZERO_ADDR,
  ts: Date.now(),
  ...overrides,
});

export const mockExecResult = (overrides: Partial<ExecResult> = {}): ExecResult => ({
  proposalId: 'prop_mock_001',
  txHash: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  blockNumber: 1234567,
  amountOut: '180000000000000000', // ~0.18 ETH
  gasUsed: '150000',
  status: 'success',
  chainId: SEPOLIA_CHAIN_ID,
  ...overrides,
});

export const mockExecRejected = (overrides: Partial<ExecResult> = {}): ExecResult => ({
  proposalId: 'prop_mock_001',
  txHash: ZERO_HASH,
  blockNumber: 0,
  amountOut: '0',
  gasUsed: '0',
  status: 'failed',
  error: 'mock: slippage exceeded',
  chainId: SEPOLIA_CHAIN_ID,
  ...overrides,
});

export const mockProof = (overrides: Partial<Proof> = {}): Proof => ({
  proposalId: 'prop_mock_001',
  userAddr: ('0x' + '11'.repeat(20)) as Hex,
  sessionHash: ZERO_HASH,
  proposal: mockProposal(),
  verdict: mockVerdict(),
  exec: mockExecResult(),
  rootHash: ZERO_HASH,
  anchorTx: ZERO_HASH,
  anchorChainId: 16602, // 0G Galileo
  logCid: 'mock-log-cid-000',
  createdAt: Date.now(),
  ...overrides,
});
