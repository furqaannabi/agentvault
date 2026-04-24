// ── Shared interfaces — locked Day 1 with BE team ────────────────
// Edit only after pinging BE1/BE2. No silent changes.

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

export interface PolicyRule {
  name:    string
  ok:      boolean
  detail?: string
}

export interface PolicyVerdict {
  proposalId:       string
  ok:               boolean
  rules:            PolicyRule[]
  teemlAttestation: string
  sig:              string
}

export interface ExecResult {
  proposalId:  string
  txHash:      string
  blockNumber: number
  amountOut:   string
  gasUsed:     string
  status:      'success' | 'failed' | 'reverted'
  error?:      string
}

export interface Proof {
  proposalId: string
  proposal:   TradeProposal
  verdict:    PolicyVerdict
  exec:       ExecResult
  rootHash:   string
  anchorTx:   string
  logCid:     string
}

// ── FE-only types ─────────────────────────────────────────────────

export type MessageRole = 'user' | 'twin'

export interface ChatMessage {
  id:          string
  role:        MessageRole
  content:     string
  timestamp:   number
  isStreaming?: boolean
}

export interface ConversationSession {
  id:            string
  title:         string
  createdAt:     number
  lastMessageAt: number
  messageCount:  number
}

// SSE chunks from POST /chat
export type StreamChunk =
  | { type: 'text';        payload: string }
  | { type: 'proposal';    payload: TradeProposal }
  | { type: 'proof_ready'; payload: { proofId: string } }
  | { type: 'error';       payload: string }

// UI projection of Proof → ordered display steps for ProofExplorer
export type ProofStepStatus = 'verified' | 'pending' | 'failed'

export interface ProofStep {
  index:       number
  label:       string
  hash:        string
  signer?:     string
  status:      ProofStepStatus
  verifierUrl?: string
  detail?:     string
}
