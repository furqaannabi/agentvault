'use client'

import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatInput } from '@/components/chat/ChatInput'

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) 0' }}>
        <MessageBubble
          role="user"
          content="Rebalance my portfolio — move 10% into ETH."
          timestamp={Date.now() - 60000}
        />
        <MessageBubble
          role="twin"
          content="Analysing current allocation. ETH is underweighted at 4.2% vs target 14%. I'll propose a swap of 500 USDC → ETH at current market price."
          timestamp={Date.now() - 30000}
          isStreaming
        />
      </div>

      {/* Input pinned to bottom */}
      <ChatInput onSend={() => {}} />
    </div>
  )
}
