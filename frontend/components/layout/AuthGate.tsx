'use client'

import React, { useEffect } from 'react'
import { useSessionStore } from '@/lib/store/sessionStore'

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const hasHydrated   = useSessionStore((s) => s._hasHydrated)
  const signedSession = useSessionStore((s) => s.signedSession)

  useEffect(() => {
    if (!hasHydrated) return
    if (!signedSession) {
      window.location.replace('/connect')
      return
    }
    // Catch bfcache back-navigation after disconnect
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted && !useSessionStore.getState().signedSession) {
        window.location.replace('/connect')
      }
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [hasHydrated, signedSession])

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
        <div style={{
          fontFamily:    'var(--font-display)',
          fontWeight:    'var(--weight-bold)',
          fontSize:      'var(--text-xl)',
          color:         'var(--color-text-primary)',
          letterSpacing: 'var(--tracking-tight)',
        }}>
          AgentVault
        </div>
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
          <span aria-hidden style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   'var(--text-base)',
            color:      'var(--color-text-primary)',
            lineHeight: 1,
            animation:  'cursor-blink 0.8s linear infinite',
          }}>
            ▊
          </span>
        </div>
      </div>
    )
  }

  if (!signedSession) return null

  return <>{children}</>
}
