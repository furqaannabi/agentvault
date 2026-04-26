'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SignedSession, Config } from '../types'

interface SessionState {
  signedSession: SignedSession | null
  config:        Config | null

  setSession: (s: SignedSession) => void
  clearSession: () => void
  setConfig: (c: Config) => void
  authHeader: () => string | null
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      signedSession: null,
      config:        null,

      setSession:   (s) => set({ signedSession: s }),
      clearSession: ()  => set({ signedSession: null }),
      setConfig:    (c) => set({ config: c }),

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
    },
  ),
)
