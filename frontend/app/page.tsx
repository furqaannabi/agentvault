'use client'

import { useRef, useCallback } from 'react'
import { ChatStream, type ChatStreamHandle } from '@/components/chat/ChatStream'
import { ChatInput } from '@/components/chat/ChatInput'
import { ApprovalPrompt } from '@/components/chat/ApprovalPrompt'
import { useChatStore } from '@/lib/store/chatStore'
import { useProofStore } from '@/lib/store/proofStore'
import type { Proof } from '@/lib/types'
import { PolicyChecklist as _PolicyChecklist } from '@/components/policy/PolicyChecklist'
import { ProofStep as _ProofStep } from '@/components/proof/ProofStep'
import { ProofChain as _ProofChain } from '@/components/proof/ProofChain'
import { ProofExplorer as _ProofExplorer } from '@/components/proof/ProofExplorer'

const SESSION_ID = 'default'

export default function HomePage() {
  const streamRef       = useRef<ChatStreamHandle>(null)
  const pendingProposal = useChatStore((s) => s.pendingProposal)
  const setPending      = useChatStore((s) => s.setPendingProposal)
  const addMessage      = useChatStore((s) => s.addMessage)
  const isStreaming     = useChatStore((s) => s.isStreaming)
  const addProof        = useProofStore((s) => s.addProof)

  const handleApproved = useCallback((proof: Proof) => {
    // Persist proof in store
    addProof(proof)
    // Clear pending proposal
    setPending(null)
    // Add confirmation message to chat
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ChatStream
        ref={streamRef}
        sessionId={SESSION_ID}
        onProposalReceived={() => {}}
      />

      {pendingProposal && (
        <ApprovalPrompt
          proposal={pendingProposal}
          onApproved={handleApproved}
          onRejected={handleRejected}
        />
      )}

      <ChatInput
        onSend={(msg) => streamRef.current?.sendMessage(msg)}
        disabled={isStreaming || !!pendingProposal}
      />
    </div>
  )
}
