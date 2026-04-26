'use client'

import { useRef, useCallback, useEffect } from 'react'
import { ChatStream, type ChatStreamHandle } from '@/components/chat/ChatStream'
import { ChatInput } from '@/components/chat/ChatInput'
import { ApprovalPrompt } from '@/components/chat/ApprovalPrompt'
import { ProofIndex } from '@/components/proof/ProofIndex'
import { useChatStore } from '@/lib/store/chatStore'
import { useProofStore } from '@/lib/store/proofStore'
import type { Proof } from '@/lib/types'

export default function HomePage() {
  const streamRef      = useRef<ChatStreamHandle>(null)
  const activeId        = useChatStore((s) => s.activeSessionId)
  const sessions        = useChatStore((s) => s.sessions)
  const createSession   = useChatStore((s) => s.createSession)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const pendingProposal = useChatStore((s) => s.pendingProposal)
  const setPending     = useChatStore((s) => s.setPendingProposal)
  const addMessage     = useChatStore((s) => s.addMessage)
  const isStreaming    = useChatStore((s) => s.isStreaming)
  const addProof       = useProofStore((s) => s.addProof)

  // On load: restore most recent session or create first one
  useEffect(() => {
    if (activeId) return                           // already have one
    if (sessions.length > 0) {
      setActiveSession(sessions[0].id)             // restore most recent
    } else {
      createSession()                              // truly first visit
    }
  }, [activeId, sessions, createSession, setActiveSession])

  const handleApproved = useCallback((proof: Proof) => {
    if (!proof?.proposalId) {
      setPending(null)
      return
    }
    addProof(proof)
    setPending(null)
    addMessage({
      id:        crypto.randomUUID(),
      role:      'twin',
      content:   `Trade executed. Proof assembled and anchored on 0G Chain.\nView evidence chain → /proof/${proof.proposalId}`,
      timestamp: Date.now(),
    })
  }, [addProof, setPending, addMessage])

  const handleRejected = useCallback(() => {
    setPending(null)
    addMessage({
      id:        crypto.randomUUID(),
      role:      'twin',
      content:   'Trade aborted. No transaction submitted.',
      timestamp: Date.now(),
    })
  }, [setPending, addMessage])

  if (!activeId) return null

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* ── Left: chat panel ──────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <ChatStream
          ref={streamRef}
          sessionId={activeId}
          onProposalReceived={() => {}}
        />

        {pendingProposal ? (
          <ApprovalPrompt
            proposal={pendingProposal}
            onApproved={handleApproved}
            onRejected={handleRejected}
          />
        ) : null}

        <ChatInput
          onSend={(msg) => streamRef.current?.sendMessage(msg)}
          disabled={isStreaming || !!pendingProposal}
        />
      </div>

      {/* ── Right: proof history panel ────────────────────────── */}
      <div
        style={{
          width:           320,
          flexShrink:      0,
          borderLeft:      'var(--border-width) solid var(--color-border)',
          overflowY:       'auto',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        <ProofIndex />
      </div>
    </div>
  )
}
