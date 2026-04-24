'use client'

import { useRef } from 'react'
import { ChatStream, type ChatStreamHandle } from '@/components/chat/ChatStream'
import { ChatInput } from '@/components/chat/ChatInput'

const SESSION_ID = 'default'

export default function HomePage() {
  const streamRef = useRef<ChatStreamHandle>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ChatStream
        ref={streamRef}
        sessionId={SESSION_ID}
      />
      <ChatInput
        onSend={(msg) => streamRef.current?.sendMessage(msg)}
        disabled={false}
      />
    </div>
  )
}
