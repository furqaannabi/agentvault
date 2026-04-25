'use client'

import React, {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { Label, Mono } from '@/components/design-system/Typography'
import { useChatStore } from '@/lib/store/chatStore'
import { streamChat } from '@/lib/api'
import type { TradeProposal } from '@/lib/types'

// ── Public handle exposed via ref ──────────────────────────────────────────────

export interface ChatStreamHandle {
  sendMessage: (content: string) => Promise<void>
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ChatStreamProps {
  sessionId:           string
  onProposalReceived?: (proposal: TradeProposal) => void
  onProofReady?:       (proofId: string) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ChatStream = forwardRef<ChatStreamHandle, ChatStreamProps>(
  function ChatStream({ sessionId, onProposalReceived, onProofReady }, ref) {
    const messages        = useChatStore((s) => s.messages)
    const isStreaming     = useChatStore((s) => s.isStreaming)
    const addMessage      = useChatStore((s) => s.addMessage)
    const updateLastMessage = useChatStore((s) => s.updateLastMessage)
    const finalizeStream  = useChatStore((s) => s.finalizeStream)
    const setPendingProposal = useChatStore((s) => s.setPendingProposal)

    const [error, setError]   = useState<string | null>(null)
    const bottomRef           = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when messages update
    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Stream a message through the API
    const sendMessage = useCallback(
      async (content: string) => {
        if (isStreaming) return
        setError(null)

        // Add user message immediately
        addMessage({
          id:        crypto.randomUUID(),
          role:      'user',
          content,
          timestamp: Date.now(),
        })

        // Twin bubble is seeded on the first text chunk, not upfront,
        // so a proposal-only response doesn't leave an empty bubble.
        let twinBubbleSeeded = false

        try {
          for await (const chunk of streamChat(content, sessionId)) {
            if (chunk.type === 'text') {
              if (!twinBubbleSeeded) {
                addMessage({
                  id:          crypto.randomUUID(),
                  role:        'twin',
                  content:     '',
                  timestamp:   Date.now(),
                  isStreaming: true,
                })
                twinBubbleSeeded = true
              }
              updateLastMessage(chunk.payload as string)
            } else if (chunk.type === 'proposal') {
              setPendingProposal(chunk.payload as TradeProposal)
              onProposalReceived?.(chunk.payload as TradeProposal)
              finalizeStream()
              break
            } else if (chunk.type === 'proof_ready') {
              const { proofId } = chunk.payload as { proofId: string }
              onProofReady?.(proofId)
              finalizeStream()
              break
            } else if (chunk.type === 'error') {
              setError(chunk.payload as string)
              break
            }
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Connection failed. Try again.',
          )
        } finally {
          finalizeStream()
        }
      },
      [
        sessionId,
        isStreaming,
        addMessage,
        updateLastMessage,
        finalizeStream,
        setPendingProposal,
        onProposalReceived,
        onProofReady,
      ],
    )

    // Expose sendMessage to parent via ref
    useImperativeHandle(ref, () => ({ sendMessage }), [sendMessage])

    // ── Render ───────────────────────────────────────────────────────────────

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Empty state */}
        {messages.length === 0 && !error && (
          <div
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            'var(--space-3)',
            }}
          >
            <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>
              [ AWAITING INPUT ]
            </Label>
            <Mono size="xs" color="muted" as="p" style={{ margin: 0, textAlign: 'center' }}>
              Describe a portfolio action to begin.
            </Mono>
          </div>
        )}

        {/* Message list */}
        {messages.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) 0' }}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                isStreaming={msg.isStreaming}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              margin:        'var(--space-4) var(--space-6)',
              padding:       'var(--space-3) var(--space-4)',
              border:        'var(--border-width) solid var(--color-accent-red)',
              backgroundColor: 'var(--color-accent-red-dim)',
              display:       'flex',
              alignItems:    'center',
              justifyContent: 'space-between',
              gap:           'var(--space-4)',
              flexShrink:    0,
            }}
          >
            <Mono size="xs" color="red" as="span">{error}</Mono>
            <button
              onClick={() => setError(null)}
              style={{
                background:  'none',
                border:      'none',
                cursor:      'pointer',
                fontFamily:  'var(--font-mono)',
                fontSize:    'var(--text-xs)',
                color:       'var(--color-accent-red)',
                flexShrink:  0,
                letterSpacing: 'var(--tracking-wider)',
                textTransform: 'uppercase',
              }}
            >
              DISMISS
            </button>
          </div>
        )}
      </div>
    )
  },
)
