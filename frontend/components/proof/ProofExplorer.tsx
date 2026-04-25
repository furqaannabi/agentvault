'use client'

import React, { useEffect, useState } from 'react'
import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { HashDisplay } from '@/components/design-system/HashDisplay'
import { PolicyChecklist } from '@/components/policy/PolicyChecklist'
import { ProofChain } from '@/components/proof/ProofChain'
import { getProof } from '@/lib/api'
import { useProofStore } from '@/lib/store/proofStore'
import type { Proof, ProofStep } from '@/lib/types'

// ── Proof → ProofSteps mapping ─────────────────────────────────────────────────

function proofToSteps(proof: Proof): ProofStep[] {
  const passCount = proof.verdict.rules.filter((r) => r.ok).length
  const total     = proof.verdict.rules.length

  return [
    {
      index:  0,
      label:  'TWIN_REASONING',
      hash:   proof.proposal.id,
      status: 'verified' as const,
      detail: proof.proposal.reasoning,
    },
    {
      index:      1,
      label:      'OG_COMPUTE_ATTESTATION',
      hash:       proof.verdict.teemlAttestation,
      status:     'verified',
      verifierUrl: `https://0gscan.io/tx/${proof.verdict.teemlAttestation}`,
      detail:     'TeeML sealed inference attestation from 0G Compute node. Reasoning was executed inside a trusted execution environment.',
    },
    {
      index:  2,
      label:  'POLICY_VERDICT',
      hash:   proof.verdict.sig,
      status: proof.verdict.ok ? 'verified' : 'failed',
      detail: `${passCount}/${total} deterministic rules passed. ${proof.verdict.ok ? 'Trade cleared for execution.' : 'Trade blocked by policy engine.'}`,
    },
    {
      index:      3,
      label:      'UNISWAP_EXECUTION',
      hash:       proof.exec.txHash,
      status:     proof.exec.status === 'success' ? 'verified' : 'failed',
      verifierUrl: `https://sepolia.etherscan.io/tx/${proof.exec.txHash}`,
      detail:     `Settled at block ${proof.exec.blockNumber}. Received ${proof.exec.amountOut}. Gas used: ${proof.exec.gasUsed}.`,
    },
    {
      index:      4,
      label:      'ON_CHAIN_ANCHOR',
      hash:       proof.anchorTx,
      status:     'verified',
      verifierUrl: `https://0gscan.io/tx/${proof.anchorTx}`,
      detail:     'Merkle root of the full proof chain anchored to 0G Chain via ProofAnchor.sol.',
    },
    {
      index:      5,
      label:      'STORAGE_LOG',
      hash:       proof.logCid,
      status:     'verified',
      verifierUrl: `https://storagescan.0g.ai/object/${proof.logCid}`,
      detail:     'Immutable decision record appended to 0G Storage Log stream. Tamper-evident and permanently retrievable.',
    },
  ]
}

// ── Section skeleton ───────────────────────────────────────────────────────────

function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height:          10,
            width:           i === 0 ? '40%' : i === lines - 1 ? '60%' : '80%',
            backgroundColor: 'var(--color-bg-elevated)',
          }}
        />
      ))}
    </div>
  )
}

// ── Trade summary ──────────────────────────────────────────────────────────────

function TradeSummary({ proof }: { proof: Proof }) {
  const { proposal, exec } = proof
  const slippage = (proposal.maxSlippageBps / 100).toFixed(2)

  return (
    <div
      style={{
        border:          'var(--border-width) solid var(--color-border)',
        backgroundColor: 'var(--color-bg-surface)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         'var(--space-3) var(--space-4)',
          borderBottom:    'var(--border-width) solid var(--color-border)',
          backgroundColor: 'var(--color-bg-elevated)',
        }}
      >
        <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>PROPOSED ACTION</Label>
        <Badge
          variant={exec.status === 'success' ? 'verified' : 'fail'}
          size="sm"
          label={exec.status.toUpperCase()}
        />
      </div>

      <div style={{ padding: 'var(--space-5) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Trade display */}
        <Heading size="2xl" style={{ letterSpacing: 'var(--tracking-tight)' }}>
          SWAP {proposal.amountIn} {proposal.tokenIn} → {proposal.tokenOut}
        </Heading>

        {/* Metadata row */}
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div>
            <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>MAX SLIPPAGE</Label>
            <Mono size="sm" color="primary" as="span">{slippage}%</Mono>
          </div>
          <div>
            <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>RECEIVED</Label>
            <Mono size="sm" color="primary" as="span">{exec.amountOut} {proposal.tokenOut}</Mono>
          </div>
          <div>
            <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>BLOCK</Label>
            <Mono size="sm" color="primary" as="span">{exec.blockNumber}</Mono>
          </div>
          <div>
            <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>GAS</Label>
            <Mono size="sm" color="primary" as="span">{exec.gasUsed}</Mono>
          </div>
        </div>

        {/* Tx hash */}
        <div>
          <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>TX HASH</Label>
          <HashDisplay hash={exec.txHash} prefixChars={8} suffixChars={8} showCopy />
        </div>

        {/* Reasoning */}
        <div
          style={{
            borderLeft:  'var(--border-width-thick) solid var(--color-border-strong)',
            paddingLeft: 'var(--space-3)',
          }}
        >
          <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>REASONING</Label>
          <Body size="sm" color="secondary">{proposal.reasoning}</Body>
        </div>
      </div>
    </div>
  )
}

// ── Root hash footer ───────────────────────────────────────────────────────────

function RootHashFooter({ rootHash }: { rootHash: string }) {
  return (
    <div
      style={{
        border:          'var(--border-width) solid var(--color-border)',
        backgroundColor: 'var(--color-bg-surface)',
        padding:         'var(--space-4)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             'var(--space-4)',
        flexWrap:        'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 }}>
        <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>ROOT HASH SIGNATURE</Label>
        <HashDisplay hash={rootHash} prefixChars={12} suffixChars={12} showCopy />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
        <Mono size="xs" color="muted" as="span">⬡</Mono>
        <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>Cryptographically Secure</Label>
      </div>
    </div>
  )
}

// ── ProofExplorer ──────────────────────────────────────────────────────────────

interface ProofExplorerProps {
  proofId: string
}

export function ProofExplorer({ proofId }: ProofExplorerProps) {
  const cachedProof = useProofStore((s) => s.proofs[proofId])
  const addProof    = useProofStore((s) => s.addProof)

  const [proof, setProof]     = useState<Proof | null>(cachedProof ?? null)
  const [loading, setLoading] = useState(!cachedProof)
  const [error, setError]     = useState<string | null>(null)
  const [retryCount, setRetry] = useState(0)

  useEffect(() => {
    if (cachedProof) {
      setProof(cachedProof)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getProof(proofId)
      .then((data) => {
        if (cancelled) return
        addProof(data)
        setProof(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load proof.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [proofId, cachedProof, addProof, retryCount])

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-6)' }}>
        <div
          style={{
            border:          'var(--border-width) solid var(--color-accent-red)',
            backgroundColor: 'var(--color-accent-red-dim)',
            padding:         'var(--space-4)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
          }}
        >
          <Mono size="sm" color="red" as="span">{error}</Mono>
          <button
            onClick={() => setRetry((n) => n + 1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              color: 'var(--color-accent-red)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-wider)',
            }}
          >
            RETRY
          </button>
        </div>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <SectionSkeleton lines={2} />
        <SectionSkeleton lines={4} />
        <ProofChain steps={[]} isLoading />
      </div>
    )
  }

  if (!proof) return null

  const steps = proofToSteps(proof)

  // ── Populated ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 'var(--space-8) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 860 }}>
      {/* Page heading */}
      <div>
        <Heading size="2xl">
          Evidence Chain // {proof.proposalId.slice(0, 8).toUpperCase()}
        </Heading>
        <Body size="sm" color="secondary" style={{ marginTop: 'var(--space-2)' }}>
          Cryptographic audit trail for automated decision block. Each step independently verifiable.
        </Body>
      </div>

      {/* Trade summary */}
      <TradeSummary proof={proof} />

      {/* Policy verdict */}
      <PolicyChecklist verdict={proof.verdict} />

      {/* Attestation ledger */}
      <ProofChain steps={steps} />

      {/* Root hash */}
      <RootHashFooter rootHash={proof.rootHash} />
    </div>
  )
}
