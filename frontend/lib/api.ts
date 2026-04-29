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
  // Wrap fetch so network-level failures (ERR_EMPTY_RESPONSE, ECONNRESET, etc.)
  // produce a readable message instead of a generic "Failed to fetch"
  const doFetch = () => fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  getAuthHeader(),
      ...init.headers,
    },
  }).catch((err: Error) => {
    const msg = err.message ?? ''
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error('Server closed the connection — the request may have timed out or the server crashed. Try a smaller amount.')
    }
    throw err
  })
  const res = await doFetch()

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
  const data = await safeJson<Record<string, unknown>>(res)

  // Policy rejected the trade
  if ('rejected' in data) {
    throw new Error('Trade blocked by policy engine.')
  }

  // Execution failed on-chain
  if (data.error === 'exec_failed') {
    const exec = data.exec as ExecFailedError['exec']
    throw new Error(exec?.error ?? 'Execution failed on-chain.')
  }

  // Other backend errors
  if ('error' in data) {
    throw new Error((data.detail as string) ?? (data.error as string) ?? 'Approval failed.')
  }

  if (!res.ok) throw new Error(`POST /approve failed: ${res.status}`)

  const proof = (data as { proof: Proof }).proof
  if (!proof) throw new Error('Server returned no proof — trade may have failed silently.')
  return proof
}

// ── Approve via SSE (Item 10) ────────────────────────────────────────────────

export type ExecStage =
  | 'POLICY_CHECK'
  | 'SUBMITTING'
  | 'BROADCAST'
  | 'CONFIRMING'
  | 'SETTLED'
  | 'FAILED'

export interface ExecStageEvent {
  stage:    ExecStage
  step?:    'approval' | 'swap'
  payload?: Record<string, unknown>
}

export interface ApproveStreamHandlers {
  onStage:    (event: ExecStageEvent) => void
  onSettled?: (proof: Proof) => void
  onFailed?:  (info: { error: string; keeperhubAuditUrl?: string; lastRevertReason?: string }) => void
  /** Optional `?demo=force-retry` flag forwarded as a query param. */
  demo?:      'force-retry'
}

/**
 * Stream-mode wrapper around POST /approve. Sends Accept: text/event-stream
 * so the backend emits per-stage SSE frames (POLICY_CHECK → SUBMITTING →
 * BROADCAST → CONFIRMING → SETTLED|FAILED). Uses fetch + ReadableStream
 * because native EventSource cannot send the Authorization header we rely
 * on for session auth.
 *
 * Returns the final Proof on SETTLED. Throws on FAILED so callers can
 * propagate via standard try/catch alongside the JSON-mode approveProposal.
 */
export async function approveProposalStream(
  proposalId:  string,
  handlers:    ApproveStreamHandlers,
): Promise<Proof> {
  const qs = handlers.demo ? `?demo=${handlers.demo}` : ''
  const res = await fetch(`${API_BASE}/approve${qs}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept:         'text/event-stream',
      Authorization:  getAuthHeader(),
    },
    body:    JSON.stringify({ proposalId }),
  })
  if (res.status === 401) {
    useSessionStore.getState().clearSession()
    throw new SessionExpiredError('expired')
  }
  if (!res.ok || !res.body) {
    throw new Error(`POST /approve (stream) failed: ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastEvent: ExecStageEvent | null = null

  // Parse a single SSE record: event:* and data:* lines, terminator = blank line.
  const parseRecord = (chunk: string): ExecStageEvent | null => {
    let data = ''
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return null
    try {
      return JSON.parse(data) as ExecStageEvent
    } catch {
      return null
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const records = buffer.split('\n\n')
    buffer = records.pop() ?? ''
    for (const record of records) {
      const event = parseRecord(record)
      if (!event) continue
      lastEvent = event
      handlers.onStage(event)
      if (event.stage === 'FAILED') {
        const payload = (event.payload ?? {}) as {
          error?:           string
          keeperhubAuditUrl?: string
          lastRevertReason?:  string
        }
        handlers.onFailed?.({
          error:             payload.error ?? 'execution failed',
          keeperhubAuditUrl: payload.keeperhubAuditUrl,
          lastRevertReason:  payload.lastRevertReason,
        })
        throw new Error(payload.error ?? 'execution failed')
      }
    }
  }

  if (!lastEvent || lastEvent.stage !== 'SETTLED') {
    throw new Error('Stream closed before SETTLED — server may have died mid-trade.')
  }
  const proof = (lastEvent.payload as { proof?: Proof } | undefined)?.proof
  if (!proof) throw new Error('SETTLED frame missing proof body.')
  handlers.onSettled?.(proof)
  return proof
}

export async function getProof(id: string): Promise<Proof> {
  const res  = await authedFetch(`/proof/${id}`)
  if (!res.ok) throw new Error(`GET /proof/${id} failed: ${res.status}`)
  const data = await safeJson<{ proof: Proof }>(res)
  return data.proof
}

export async function getProofs(): Promise<Proof[]> {
  const res  = await authedFetch('/proofs')
  if (!res.ok) throw new Error(`GET /proofs failed: ${res.status}`)
  const data = await safeJson<{ proofs: Proof[] }>(res)
  return data.proofs ?? []
}
