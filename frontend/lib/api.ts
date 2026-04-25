import type { Proof, StreamChunk } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// POST /chat → SSE stream of StreamChunks
// Yields text deltas, then a proposal chunk, then optionally proof_ready
export async function* streamChat(
  message: string,
  sessionId: string,
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${API_BASE}/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message, sessionId }),
  })

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data) as StreamChunk
        } catch {
          // skip malformed SSE chunks
        }
      }
    }
  } finally {
    reader.cancel()
  }
}

// POST /approve → triggers policy engine + swap + proof assembly
// Returns the assembled Proof
export async function approveProposal(proposalId: string): Promise<Proof> {
  const response = await fetch(`${API_BASE}/approve`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ proposalId }),
  })
  if (!response.ok) throw new Error(`Approve failed: ${response.status}`)
  return response.json()
}

// POST /approve with reject flag — signals user rejected the trade
export async function rejectProposal(proposalId: string): Promise<void> {
  await fetch(`${API_BASE}/approve`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ proposalId, rejected: true }),
  })
}

// GET /proof/:id → single Proof object
export async function getProof(id: string): Promise<Proof> {
  const response = await fetch(`${API_BASE}/proof/${id}`)
  if (!response.ok) throw new Error(`Failed to fetch proof: ${response.status}`)
  return response.json()
}

// GET /proof → list of all Proofs (for ProofIndex)
export async function getProofs(): Promise<Proof[]> {
  const response = await fetch(`${API_BASE}/proof`)
  if (!response.ok) throw new Error(`Failed to fetch proofs: ${response.status}`)
  return response.json()
}
