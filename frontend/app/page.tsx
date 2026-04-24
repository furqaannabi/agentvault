import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'

export default function HomePage() {
  return (
    <main
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            'var(--space-4)',
        minHeight:      '100vh',
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
        <Badge variant="active" dot />
        <Badge variant="syncing" />
      </div>
      <Mono size="xs" color="muted" as="samp">V.2.4.0-ACTIVE</Mono>
    </main>
  )
}
