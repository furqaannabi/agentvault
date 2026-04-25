'use client'

import React, { memo } from 'react'
import { motion, type Variants } from 'framer-motion'
import { ProofStep } from '@/components/proof/ProofStep'
import { Label } from '@/components/design-system/Typography'
import type { ProofStep as ProofStepType } from '@/lib/types'

interface ProofChainProps {
  steps:      ProofStepType[]
  isLoading?: boolean
}

// ── Animation variants ─────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

// ── Skeleton row — matches ProofStep shape exactly ────────────────────────────

function SkeletonRow() {
  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: '28px 1fr auto auto',
        alignItems:          'center',
        gap:                 'var(--space-4)',
        padding:             'var(--space-4)',
        borderBottom:        'var(--border-width) solid var(--color-border-subtle)',
      }}
    >
      {/* Index */}
      <div style={{ height: 10, width: 16, backgroundColor: 'var(--color-bg-elevated)', marginLeft: 'auto' }} />
      {/* Label + hash */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <div style={{ height: 10, width: '45%', backgroundColor: 'var(--color-bg-elevated)' }} />
        <div style={{ height: 10, width: '65%', backgroundColor: 'var(--color-bg-elevated)' }} />
      </div>
      {/* Badge */}
      <div style={{ height: 18, width: 52, backgroundColor: 'var(--color-bg-elevated)' }} />
      {/* Actions */}
      <div style={{ height: 10, width: 28, backgroundColor: 'var(--color-bg-elevated)' }} />
    </div>
  )
}

// ── ProofChain ─────────────────────────────────────────────────────────────────

export const ProofChain = memo(function ProofChain({ steps, isLoading = false }: ProofChainProps) {
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
        <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>
          ATTESTATION LEDGER
        </Label>
        {!isLoading ? (
          <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {steps.length} STEP{steps.length !== 1 ? 'S' : ''}
          </Label>
        ) : null}
      </div>

      {/* Column headers */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '28px 1fr auto auto',
          gap:                 'var(--space-4)',
          padding:             'var(--space-2) var(--space-4)',
          borderBottom:        'var(--border-width) solid var(--color-border-subtle)',
          backgroundColor:     'var(--color-bg-inset)',
        }}
      >
        <span />
        <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>STAGE · HASH</Label>
        <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>STATUS</Label>
        <span />
      </div>

      {/* Loading */}
      {isLoading ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : null}

      {/* Empty */}
      {!isLoading && steps.length === 0 ? (
        <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
          <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>
            NO PROOF STEPS
          </Label>
        </div>
      ) : null}

      {/* Populated — staggered reveal */}
      {!isLoading && steps.length > 0 ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {steps.map((step) => (
            <motion.div key={step.index} variants={itemVariants}>
              <ProofStep step={step} />
            </motion.div>
          ))}
        </motion.div>
      ) : null}
    </div>
  )
})
