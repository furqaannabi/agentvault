import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'

export default function HomePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        minHeight: '100vh',
      }}
    >
      <Label color="muted">[ AGENTVAULT — INITIALIZING ]</Label>
      <Heading size="2xl">ProofTwin</Heading>
      <Body color="secondary">Cryptographic proof for every AI agent decision.</Body>
      <Mono size="xs" color="muted" as="samp">V.2.4.0-ACTIVE</Mono>
    </main>
  )
}
