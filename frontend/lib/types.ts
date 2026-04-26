// ── Shared interfaces — aligned with real backend API ─────────────────────────

export type Hex = `0x${string}`

// ── Wallet / session ──────────────────────────────────────────────────────────

export interface AgentSession {
  user:               Hex
  delegate:           Hex
  chainId:            number
  allowedTokens:      Hex[]
  maxDailyVolumeUsd:  number
  maxTradeUsd:        number
  maxSlippageBps:     number
  cooldownSec:        number
  expiresAt:          number    // unix ms
  nonce:              Hex       // random 32 bytes
}

export interface SignedSession {
  session:   AgentSession
  signature: Hex
}

export interface PublicTokenInfo {
  address:  Hex
  symbol:   string
  decimals: number
}

export interface Config {
  delegate:       Hex
  chainId:        number
  eip712Domain:   Record<string, unknown>
  eip712Types:    Record<string, unknown>
  allowedTokens:  PublicTokenInfo[]
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface Balance {
  address:  Hex | 'native'
  symbol:   string
  decimals: number
  amount:   string   // raw bigint string — divide by 10^decimals for display
}

export interface Portfolio {
  user:      Hex
  balances:  Balance[]
  updatedAt: number
}

// ── Trade / chat ──────────────────────────────────────────────────────────────

export interface TradeProposal {
  id:             string
  action:         'swap'
  tokenIn:        string
  tokenOut:       string
  amountIn:       string
  maxSlippageBps: number
  reasoning:      string
  createdAt:      number
}

// ── Policy ────────────────────────────────────────────────────────────────────

export interface PolicyRule {
  id:      string
  pass:    boolean
  detail?: string
}

export interface PolicyVerdict {
  ok:     boolean
  rules:  PolicyRule[]
  sig:    Hex
  signer: Hex
  ts:     number
}

// ── Execution ─────────────────────────────────────────────────────────────────

export interface ExecResult {
  txHash:      Hex
  blockNumber: number
  amountOut:   string
  gasUsed:     string
  status:      'success' | 'failed' | 'reverted'
  chainId:     number
}

// ── Proof ─────────────────────────────────────────────────────────────────────

export interface Proof {
  proposalId:    string
  userAddr:      Hex
  sessionHash:   Hex
  proposal:      TradeProposal
  verdict:       PolicyVerdict
  exec:          ExecResult
  rootHash:      Hex
  anchorTx:      Hex
  anchorChainId: number
  logCid:        string
  createdAt:     number
}

// ── API response wrappers ─────────────────────────────────────────────────────

export interface ChatResponse    { proposal: TradeProposal }
export interface ApproveResponse { proof: Proof }

// ── FE-only types ─────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'twin'

export interface ChatMessage {
  id:           string
  role:         MessageRole
  content:      string
  timestamp:    number
  isStreaming?: boolean
}

export interface ConversationSession {
  id:            string
  title:         string
  createdAt:     number
  lastMessageAt: number
  messageCount:  number
}

// UI projection of Proof → ordered display steps for ProofExplorer
export type ProofStepStatus = 'verified' | 'pending' | 'failed'

export interface ProofStep {
  index:        number
  label:        string
  hash:         string
  signer?:      string
  status:       ProofStepStatus
  verifierUrl?: string
  detail?:      string
}
