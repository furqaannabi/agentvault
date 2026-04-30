'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Label, Mono, Body } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { useProofStore } from '@/lib/store/proofStore'
import { useSessionStore } from '@/lib/store/sessionStore'
import { getProofs } from '@/lib/api'
import { useShallow } from 'zustand/react/shallow'
import { formatSwapLabel } from '@/lib/format'
import type { Proof } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const d = Date.now() - ts
  const m = Math.floor(d / 60_000)
  const h = Math.floor(d / 3_600_000)
  if (m  < 1)  return 'just now'
  if (m  < 60) return `${m}m ago`
  if (h  < 24) return `${h}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

function execStatusVariant(status: string) {
  if (status === 'success') return 'verified' as const
  if (status === 'failed')  return 'fail'     as const
  return 'aborted' as const
}

// ── Skeleton row ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: '1fr auto auto auto',
      alignItems:          'center',
      gap:                 'var(--space-4)',
      padding:             'var(--space-4)',
      borderBottom:        'var(--border-width) solid var(--color-border-subtle)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <div style={{ height: 10, width: '55%', backgroundColor: 'var(--color-bg-elevated)' }} />
        <div style={{ height: 8,  width: '30%', backgroundColor: 'var(--color-bg-elevated)' }} />
      </div>
      <div style={{ height: 8,  width: 40, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 18, width: 52, backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 10, width: 12, backgroundColor: 'var(--color-bg-elevated)' }} />
    </div>
  )
}

// ── Proof row ──────────────────────────────────────────────────────────────────

function ProofRow({ proof }: { proof: Proof }) {
  const { proposal, exec } = proof
  const verdictOk = proof.verdict.ok
  const tokens    = useSessionStore((s) => s.config?.allowedTokens ?? [])
  const swapLabel = formatSwapLabel(proposal.amountIn, proposal.tokenIn, proposal.tokenOut, tokens)

  return (
    <Link href={`/proof/${proof.proposalId}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1fr auto auto auto',
          alignItems:          'center',
          gap:                 'var(--space-4)',
          padding:             'var(--space-4)',
          borderBottom:        'var(--border-width) solid var(--color-border-subtle)',
          transition:          `background-color var(--duration-fast) var(--ease-out)`,
          cursor:              'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-overlay)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <div style={{ minWidth: 0 }}>
          <Mono size="sm" color="primary" as="span" style={{
            display: 'block', marginBottom: 'var(--space-1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {swapLabel}
          </Mono>
          <Mono size="xs" color="muted" as="span">
            {proof.proposalId.slice(0, 8).toUpperCase()}
          </Mono>
        </div>
        <Mono size="xs" color="muted" as="span" style={{ whiteSpace: 'nowrap' }}>
          {relativeTime(proposal.createdAt)}
        </Mono>
        {verdictOk ? (
          <Badge variant={execStatusVariant(exec.status)} size="sm" />
        ) : (
          <Badge variant="fail" size="sm" label="BLOCKED" />
        )}
        <Mono size="xs" color="muted" as="span">→</Mono>
      </div>
    </Link>
  )
}

// ── ProofIndex ─────────────────────────────────────────────────────────────────

export function ProofIndex() {
  const storeProofs = useProofStore(useShallow((s) => s.proofList.map((id) => s.proofs[id])))
  const setProofs   = useProofStore((s) => s.setProofs)
  const addProof    = useProofStore((s) => s.addProof)

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getProofs()
      .then((proofs) => {
        if (cancelled) return
        // Merge: server is source of truth, local additions (current session) take precedence
        setProofs(proofs)
        // Re-add any local proofs not yet on server (just approved this session)
        storeProofs.forEach((p) => {
          if (p && !proofs.find((s) => s.proposalId === p.proposalId)) addProof(p)
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load proofs.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ border: 'var(--border-width) solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: 'var(--border-width) solid var(--color-border)',
        backgroundColor: 'var(--color-bg-elevated)',
      }}>
        <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>PROOF HISTORY</Label>
        {!loading ? (
          <Label color="secondary" style={{ fontSize: 'var(--text-xs)' }}>
            {storeProofs.length} RECORD{storeProofs.length !== 1 ? 'S' : ''}
          </Label>
        ) : null}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto auto',
        gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-4)',
        borderBottom: 'var(--border-width) solid var(--color-border-subtle)',
        backgroundColor: 'var(--color-bg-inset)',
      }}>
        <Label color="secondary" style={{ fontSize: 'var(--text-xs)' }}>TRADE</Label>
        <Label color="secondary" style={{ fontSize: 'var(--text-xs)' }}>TIME</Label>
        <Label color="secondary" style={{ fontSize: 'var(--text-xs)' }}>STATUS</Label>
        <span />
      </div>

      {/* Loading */}
      {loading ? <><SkeletonRow /><SkeletonRow /><SkeletonRow /></> : null}

      {/* Error */}
      {!loading && error ? (
        <div style={{ padding: 'var(--space-4)', margin: 'var(--space-4)',
          border: 'var(--border-width) solid var(--color-accent-red)',
          backgroundColor: 'var(--color-accent-red-dim)' }}>
          <Mono size="xs" color="red" as="span">{error}</Mono>
        </div>
      ) : null}

      {/* Empty */}
      {!loading && !error && storeProofs.length === 0 ? (
        <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
          <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>NO PROOFS YET</Label>
          <Body size="sm" color="muted" style={{ marginTop: 'var(--space-2)' }}>
            Approve a trade to generate your first proof.
          </Body>
        </div>
      ) : null}

      {/* Populated */}
      {!loading && storeProofs.length > 0 ? (
        <div>
          {storeProofs.map((proof) => (
            <ProofRow key={proof.proposalId} proof={proof} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
