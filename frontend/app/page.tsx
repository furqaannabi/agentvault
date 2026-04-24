'use client'

import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { HashDisplay } from '@/components/design-system/HashDisplay'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatInput } from '@/components/chat/ChatInput'

export default function HomePage() {
  return (
    <main
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            'var(--space-4)',
        padding:        'var(--space-8)',
        minHeight:      '100%',
      }}
    >
      <Label color="muted">[ AGENTVAULT — INITIALIZING ]</Label>
      <Heading size="2xl">ProofTwin</Heading>
      <Body color="secondary">Cryptographic proof for every AI agent decision.</Body>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Badge variant="verified" dot />
        <Badge variant="pass" dot />
        <Badge variant="pending" />
        <Badge variant="fail" dot />
        <Badge variant="aborted" />
        <Badge variant="confirmed" />
        <Badge variant="settled" />
        <Badge variant="bullish" />
      </div>
      <HashDisplay hash="0xebd94a82745f9c1b3f6e8d2a1c4b7f9e3d6a8c2b5e1f4a7c9d2b5e8a1c4f7d9" />
      <div style={{ width: '100%', maxWidth: 640, border: '1px solid var(--color-border)' }}>
        <MessageBubble role="user" content="Rebalance my portfolio — move 10% into ETH." timestamp={Date.now() - 60000} />
        <MessageBubble role="twin" content="Analysing current allocation. ETH is underweighted at 4.2% vs target 14%. I'll propose a swap of 500 USDC → ETH at current market price." timestamp={Date.now() - 30000} isStreaming />
        <ChatInput onSend={() => {}} />
      </div>
      <Mono size="xs" color="muted" as="samp">V.2.4.0-ACTIVE</Mono>
    </main>
  )
}
