'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, TradeProposal, ConversationSession } from '../types'

interface ChatState {
  sessions:        ConversationSession[]
  activeSessionId: string | null
  // messages keyed by sessionId so history persists per conversation
  messagesBySession: Record<string, ChatMessage[]>
  pendingProposal: TradeProposal | null
  isStreaming:     boolean

  createSession:     () => string
  setActiveSession:  (id: string) => void
  addMessage:        (message: ChatMessage) => void
  updateLastMessage: (chunk: string) => void
  finalizeStream:    () => void
  setPendingProposal:(proposal: TradeProposal | null) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions:          [],
      activeSessionId:   null,
      messagesBySession: {},
      pendingProposal:   null,
      isStreaming:       false,

      createSession: () => {
        const id = crypto.randomUUID()
        const session: ConversationSession = {
          id,
          title:         'New conversation',
          createdAt:     Date.now(),
          lastMessageAt: Date.now(),
          messageCount:  0,
        }
        set((state) => ({
          sessions:        [session, ...state.sessions],
          activeSessionId: id,
          pendingProposal: null,
        }))
        return id
      },

      setActiveSession: (id) => {
        const { sessions } = get()
        if (!sessions.find((s) => s.id === id)) return
        set({ activeSessionId: id, pendingProposal: null })
      },

      addMessage: (message) =>
        set((state) => {
          const sid      = state.activeSessionId
          if (!sid) return state
          const prev     = state.messagesBySession[sid] ?? []
          const messages = [...prev, message]

          // Update session metadata from first user message
          const sessions = state.sessions.map((s) => {
            if (s.id !== sid) return s
            const title = message.role === 'user' && prev.length === 0
              ? message.content.slice(0, 48)
              : s.title
            return { ...s, title, lastMessageAt: message.timestamp, messageCount: s.messageCount + 1 }
          })

          return {
            sessions,
            messagesBySession: { ...state.messagesBySession, [sid]: messages },
          }
        }),

      updateLastMessage: (chunk) =>
        set((state) => {
          const sid = state.activeSessionId
          if (!sid) return state
          const prev = [...(state.messagesBySession[sid] ?? [])]
          const last = prev[prev.length - 1]
          if (last?.isStreaming) {
            prev[prev.length - 1] = { ...last, content: last.content + chunk }
          }
          return {
            isStreaming:       true,
            messagesBySession: { ...state.messagesBySession, [sid]: prev },
          }
        }),

      finalizeStream: () =>
        set((state) => {
          const sid = state.activeSessionId
          if (!sid) return { isStreaming: false }
          const messages = (state.messagesBySession[sid] ?? []).map(
            (m) => ({ ...m, isStreaming: false }),
          )
          return {
            isStreaming:       false,
            messagesBySession: { ...state.messagesBySession, [sid]: messages },
          }
        }),

      setPendingProposal: (proposal) => set({ pendingProposal: proposal }),
    }),
    {
      name: 'agentvault-chat',
      partialize: (state) => ({
        sessions:          state.sessions,
        activeSessionId:   state.activeSessionId,
        messagesBySession: state.messagesBySession,
      }),
    },
  ),
)

// Selector — use this anywhere you need the active session's messages
export const selectMessages = (s: ChatState) =>
  s.activeSessionId ? (s.messagesBySession[s.activeSessionId] ?? []) : []
