'use client'

import { create } from 'zustand'
import type { Proof } from '../types'

interface ProofState {
  proofs:    Record<string, Proof>
  proofList: string[]
  isLoading: boolean
  error:     string | null

  setProofs:  (proofs: Proof[]) => void
  addProof:   (proof: Proof) => void
  setLoading: (loading: boolean) => void
  setError:   (error: string | null) => void
}

export const useProofStore = create<ProofState>((set) => ({
  proofs:    {},
  proofList: [],
  isLoading: false,
  error:     null,

  setProofs: (proofs) =>
    set({
      proofs:    Object.fromEntries(proofs.map((p) => [p.proposalId, p])),
      proofList: proofs.map((p) => p.proposalId),
    }),

  addProof: (proof) =>
    set((state) => ({
      proofs:    { ...state.proofs, [proof.proposalId]: proof },
      proofList: state.proofList.includes(proof.proposalId)
        ? state.proofList
        : [proof.proposalId, ...state.proofList],
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError:   (error) => set({ error }),
}))
