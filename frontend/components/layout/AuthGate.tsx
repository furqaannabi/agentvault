'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/lib/store/sessionStore'
import { Label, Mono } from '@/components/design-system/Typography'

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const router        = useRouter()
  const hasHydrated   = useSessionStore((s) => s._hasHydrated)
  const signedSession = useSessionStore((s) => s.signedSession)

  useEffect(() => {
    if (!hasHydrated) return
    if (!signedSession) router.replace('/connect')
  }, [hasHydrated, signedSession, router])

  // ── Loading splash ─────────────────────────────────────────────
  if (!hasHydrated) {
    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100vh',
        gap:            'var(--space-4)',
        backgroundColor: 'var(--color-bg-base)',
      }}>
        <div style={{
          fontFamily:    'var(--font-display)',
          fontWeight:    'var(--weight-bold)',
          fontSize:      'var(--text-xl)',
          color:         'var(--color-text-primary)',
          letterSpacing: 'var(--tracking-tight)',
        }}>
          AgentVault
        </div>
        <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>
          [ INITIALIZING ]
        </Label>
      </div>
    )
  }

  // Not authenticated — render nothing while redirect fires
  if (!signedSession) return null

  return <>{children}</>
}
