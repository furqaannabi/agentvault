'use client'

import { create } from 'zustand'
import type { ChatMessage, TradeProposal, ConversationSession } from '../types'

interface ChatState {
  sessions:        ConversationSession[]
  activeSessionId: string | null
  messages:        ChatMessage[]
  pendingProposal: TradeProposal | null
  isStreaming:     boolean

  createSession:     () => string
  setActiveSession:  (id: string) => void
  addMessage:        (message: ChatMessage) => void
  updateLastMessage: (chunk: string) => void
  finalizeStream:    () => void
  setPendingProposal:(proposal: TradeProposal | null) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions:        [],
  activeSessionId: null,
  messages:        [],
  pendingProposal: null,
  isStreaming:     false,

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
      messages:        [],
      pendingProposal: null,
    }))
    return id
  },

  setActiveSession: (id) => {
    const { sessions } = get()
    if (!sessions.find((s) => s.id === id)) return
    set({ activeSessionId: id, messages: [], pendingProposal: null })
  },

  addMessage: (message) =>
    set((state) => {
      const messages = [...state.messages, message]
      // Update session title from first user message and bump lastMessageAt
      const sessions = state.sessions.map((s) => {
        if (s.id !== state.activeSessionId) return s
        const title = message.role === 'user' && state.messages.length === 0
          ? message.content.slice(0, 48)
          : s.title
        return { ...s, title, lastMessageAt: message.timestamp, messageCount: s.messageCount + 1 }
      })
      return { messages, sessions }
    }),

  updateLastMessage: (chunk) =>
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (last?.isStreaming) {
        messages[messages.length - 1] = { ...last, content: last.content + chunk }
      }
      return { messages, isStreaming: true }
    }),

  finalizeStream: () =>
    set((state) => ({
      messages:    state.messages.map((m) => ({ ...m, isStreaming: false })),
      isStreaming: false,
    })),

  setPendingProposal: (proposal) => set({ pendingProposal: proposal }),
}))
