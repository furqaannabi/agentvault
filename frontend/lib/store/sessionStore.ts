'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SignedSession, Config } from '../types'

interface SessionState {
  signedSession: SignedSession | null
  config:        Config | null
  _hasHydrated:  boolean

  setSession: (s: SignedSession) => void
  clearSession: () => void
  setConfig: (c: Config) => void
  setHasHydrated: (h: boolean) => void
  authHeader: () => string | null
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      signedSession: null,
      config:        null,
      _hasHydrated:  false,

      setSession:     (s) => set({ signedSession: s }),
      clearSession:   ()  => set({ signedSession: null }),
      setConfig:      (c) => set({ config: c }),
      setHasHydrated: (h) => set({ _hasHydrated: h }),

      authHeader: () => {
        const { signedSession } = get()
        if (!signedSession) return null
        return `Session ${btoa(JSON.stringify(signedSession))}`
      },
    }),
    {
      name:    'agentvault-session',
      partialize: (state) => ({
        signedSession: state.signedSession,
        config:        state.config,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true)
      },
    },
  ),
)
