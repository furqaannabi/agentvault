import type { ProofObject, StreamChunk } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function* streamChat(
  message: string,
  sessionId: string,
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

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
}

export async function getProof(id: string): Promise<ProofObject> {
  const response = await fetch(`${API_BASE}/api/proofs/${id}`)
  if (!response.ok) throw new Error(`Failed to fetch proof: ${response.status}`)
  return response.json()
}

export async function getProofs(): Promise<ProofObject[]> {
  const response = await fetch(`${API_BASE}/api/proofs`)
  if (!response.ok) throw new Error(`Failed to fetch proofs: ${response.status}`)
  return response.json()
}
