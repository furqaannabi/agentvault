'use client'

import { create } from 'zustand'
import type { ChatMessage, TradeProposal, ConversationSession } from '../types'

interface ChatState {
  sessions:        ConversationSession[]
  activeSessionId: string | null
  messages:        ChatMessage[]
  pendingProposal: TradeProposal | null
  isStreaming:     boolean

  setActiveSession:  (id: string) => void
  addMessage:        (message: ChatMessage) => void
  updateLastMessage: (chunk: string) => void
  finalizeStream:    () => void
  setPendingProposal:(proposal: TradeProposal | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  sessions:        [],
  activeSessionId: null,
  messages:        [],
  pendingProposal: null,
  isStreaming:     false,

  setActiveSession: (id) => set({ activeSessionId: id, messages: [] }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

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
