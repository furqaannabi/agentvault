export type MessageRole = 'user' | 'twin'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface TradeProposal {
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  priceImpact: number
  route: string[]
  rationale: string
}

export interface ApprovalPrompt {
  id: string
  trade: TradeProposal
  status: 'pending' | 'approved' | 'rejected'
}

export type PolicyStatus = 'pass' | 'fail' | 'pending'

export interface PolicyCheck {
  id: string
  rule: string
  description: string
  status: PolicyStatus
  attestation?: string
  hash?: string
}

export interface PolicyVerdict {
  id: string
  tradeId: string
  checks: PolicyCheck[]
  overallStatus: PolicyStatus
  signedAt: number
  signer: string
  hash: string
}

export type ProofStepStatus = 'verified' | 'pending' | 'failed'

export interface ProofStep {
  index: number
  label: string
  hash: string
  signer?: string
  status: ProofStepStatus
  verifierUrl?: string
  expandedContent?: string
}

export interface ProofObject {
  id: string
  tradeId: string
  trade: TradeProposal
  steps: ProofStep[]
  policyVerdict: PolicyVerdict
  txHash: string
  anchorHash: string
  createdAt: number
  status: 'verified' | 'pending' | 'failed'
}

export interface StreamChunk {
  type: 'text' | 'approval_prompt' | 'proof_ready'
  payload: string | ApprovalPrompt | { proofId: string }
}

export interface ConversationSession {
  id: string
  title: string
  createdAt: number
  lastMessageAt: number
  messageCount: number
}
