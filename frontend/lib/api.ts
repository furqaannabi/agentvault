import type { Config, Proof, Portfolio, TradeProposal } from './types'
import { useSessionStore } from './store/sessionStore'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

// ── Error types ───────────────────────────────────────────────────────────────

export class SessionExpiredError extends Error {
  constructor(code: string) {
    super(`Session error: ${code}`)
    this.name = 'SessionExpiredError'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error('Backend not reachable — is the API server running?')
  }
  return JSON.parse(text) as T
}

function getAuthHeader(): string {
  const header = useSessionStore.getState().authHeader()
  if (!header) throw new SessionExpiredError('no_session')
  return header
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = getAuthHeader()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  auth,
      ...init.headers,
    },
  })

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    const code  = body?.code ?? 'expired'
    // Clear session on expiry/revocation so guard redirects to /connect
    if (['expired', 'revoked', 'missing_or_malformed_session'].includes(code)) {
      useSessionStore.getState().clearSession()
    }
    throw new SessionExpiredError(code)
  }

  return res
}

// ── Public endpoints (no auth) ────────────────────────────────────────────────

export async function getConfig(): Promise<Config> {
  const res = await fetch(`${API_BASE}/config`)
  if (!res.ok) throw new Error(`GET /config failed: ${res.status}`)
  return safeJson<Config>(res)
}

export async function getPubkey(): Promise<{ signer: `0x${string}` }> {
  const res = await fetch(`${API_BASE}/pubkey`)
  if (!res.ok) throw new Error(`GET /pubkey failed: ${res.status}`)
  return safeJson<{ signer: `0x${string}` }>(res)
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

// ── Session endpoints ─────────────────────────────────────────────────────────

export async function validateSession(): Promise<{
  ok: boolean
  user: string
  delegate: string
  expiresAt: number
  nonce: string
}> {
  const res = await authedFetch('/session/validate', { method: 'POST' })
  if (!res.ok) throw new Error(`POST /session/validate failed: ${res.status}`)
  return safeJson(res)
}

export async function deleteSession(): Promise<void> {
  try {
    await authedFetch('/session', { method: 'DELETE' })
  } catch {
    // Best-effort — clear local state regardless
  }
  useSessionStore.getState().clearSession()
}

// ── Authenticated endpoints ───────────────────────────────────────────────────

export async function getPortfolio(): Promise<Portfolio> {
  const res = await authedFetch('/portfolio')
  if (!res.ok) throw new Error(`GET /portfolio failed: ${res.status}`)
  return safeJson<Portfolio>(res)
}

export interface ChatApiResponse {
  reply?:    string
  proposal?: TradeProposal
}

export async function postChat(msg: string): Promise<ChatApiResponse> {
  const res = await authedFetch('/chat', {
    method: 'POST',
    body:   JSON.stringify({ msg }),
  })
  if (!res.ok) throw new Error(`POST /chat failed: ${res.status}`)
  return safeJson<ChatApiResponse>(res)
}

export interface ExecFailedError {
  error:   'exec_failed'
  exec:    { proposalId: string; txHash: string; status: string; error: string; chainId: number }
  verdict: { ok: boolean; rules: { id: string; pass: boolean }[] }
}

export async function approveProposal(proposalId: string): Promise<Proof> {
  const res  = await authedFetch('/approve', {
    method: 'POST',
    body:   JSON.stringify({ proposalId }),
  })
  const data = await safeJson<{ proof: Proof } | ExecFailedError>(res)

  if ('error' in data && data.error === 'exec_failed') {
    // Surface the backend exec error as a readable message
    throw new Error(data.exec.error ?? 'Execution failed on-chain.')
  }

  if (!res.ok) throw new Error(`POST /approve failed: ${res.status}`)
  return (data as { proof: Proof }).proof
}

export async function getProof(id: string): Promise<Proof> {
  const res = await authedFetch(`/proof/${id}`)
  if (!res.ok) throw new Error(`GET /proof/${id} failed: ${res.status}`)
  return safeJson<Proof>(res)
}
