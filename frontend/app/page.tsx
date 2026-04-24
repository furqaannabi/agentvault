'use client'

import { useRef } from 'react'
import { ChatStream, type ChatStreamHandle } from '@/components/chat/ChatStream'
import { ChatInput } from '@/components/chat/ChatInput'
import { ApprovalPrompt } from '@/components/chat/ApprovalPrompt'
import { useChatStore } from '@/lib/store/chatStore'

const SESSION_ID = 'default'

export default function HomePage() {
  const streamRef      = useRef<ChatStreamHandle>(null)
  const pendingProposal = useChatStore((s) => s.pendingProposal)
  const setPending     = useChatStore((s) => s.setPendingProposal)
  const isStreaming    = useChatStore((s) => s.isStreaming)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ChatStream
        ref={streamRef}
        sessionId={SESSION_ID}
        onProposalReceived={() => {}}
      />

      {/* Approval prompt surfaces above input when a proposal is pending */}
      {pendingProposal && (
        <ApprovalPrompt
          proposal={pendingProposal}
          onApproved={() => setPending(null)}
          onRejected={() => setPending(null)}
        />
      )}

      <ChatInput
        onSend={(msg) => streamRef.current?.sendMessage(msg)}
        disabled={isStreaming}
      />
    </div>
  )
}
