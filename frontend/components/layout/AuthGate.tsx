'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/lib/store/sessionStore'

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
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        height:          '100vh',
        gap:             'var(--space-4)',
        backgroundColor: 'var(--color-bg-base)',
      }}>
        {/* Logo */}
        <div style={{
          fontFamily:    'var(--font-display)',
          fontWeight:    'var(--weight-bold)',
          fontSize:      'var(--text-xl)',
          color:         'var(--color-text-primary)',
          letterSpacing: 'var(--tracking-tight)',
        }}>
          AgentVault
        </div>

        {/* Pulsing cursor — CSS animation fires before Framer Motion hydrates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      'var(--text-xs)',
            letterSpacing: 'var(--tracking-widest)',
            textTransform: 'uppercase',
            color:         'var(--color-text-muted)',
          }}>
            INITIALIZING
          </span>
          <span
            aria-hidden
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   'var(--text-base)',
              color:      'var(--color-text-primary)',
              lineHeight: 1,
              animation:  'cursor-blink 0.8s linear infinite',
            }}
          >
            ▊
          </span>
        </div>
      </div>
    )
  }

  // Not authenticated — render nothing while redirect fires
  if (!signedSession) return null

  return <>{children}</>
}
