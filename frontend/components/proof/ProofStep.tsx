'use client'

import React, { useState, memo } from 'react'
import { Label, Mono, Body } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { HashDisplay } from '@/components/design-system/HashDisplay'
import type { ProofStep as ProofStepType, ProofStepStatus } from '@/lib/types'

interface ProofStepProps {
  step: ProofStepType
}

function statusToBadge(status: ProofStepStatus) {
  if (status === 'verified') return 'verified' as const
  if (status === 'failed')   return 'fail'     as const
  return 'pending' as const
}

export const ProofStep = memo(function ProofStep({ step }: ProofStepProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!(step.detail || step.signer)

  return (
    <div style={{ borderBottom: 'var(--border-width) solid var(--color-border-subtle)' }}>
      {/* Main row */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '28px 1fr auto auto',
          alignItems:          'center',
          gap:                 'var(--space-4)',
          padding:             'var(--space-4)',
          cursor:              hasDetail ? 'pointer' : 'default',
        }}
        onClick={() => { if (hasDetail) setExpanded((v) => !v) }}
        role={hasDetail ? 'button' : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        {/* Step index */}
        <Mono size="xs" color="muted" as="span" style={{ textAlign: 'right' }}>
          {String(step.index + 1).padStart(2, '0')}
        </Mono>

        {/* Label + hash */}
        <div style={{ minWidth: 0 }}>
          <Label
            color="primary"
            style={{
              fontSize:      'var(--text-xs)',
              display:       'block',
              marginBottom:  'var(--space-1)',
              letterSpacing: 'var(--tracking-wider)',
            }}
          >
            {step.label}
          </Label>
          <HashDisplay hash={step.hash} prefixChars={6} suffixChars={6} showCopy />
        </div>

        {/* Status badge */}
        <Badge variant={statusToBadge(step.status)} size="sm" />

        {/* Verifier link + expand toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          {step.verifierUrl ? (
            <a
              href={step.verifierUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      'var(--text-xs)',
                letterSpacing: 'var(--tracking-wider)',
                color:         'var(--color-text-muted)',
                textDecoration: 'none',
                transition:    `color var(--duration-fast) var(--ease-out)`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
            >
              ↗
            </a>
          ) : null}
          {hasDetail ? (
            <Mono size="xs" color="muted" as="span">
              {expanded ? '[ − ]' : '[ + ]'}
            </Mono>
          ) : null}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail ? (
        <div
          style={{
            padding:         'var(--space-3) var(--space-4) var(--space-4)',
            paddingLeft:     `calc(28px + var(--space-4) + var(--space-4))`,
            backgroundColor: 'var(--color-bg-inset)',
            borderTop:       'var(--border-width) solid var(--color-border-subtle)',
            display:         'flex',
            flexDirection:   'column',
            gap:             'var(--space-2)',
          }}
        >
          {step.signer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Label color="muted" style={{ fontSize: 'var(--text-xs)', width: 60, flexShrink: 0 }}>
                SIGNER
              </Label>
              <HashDisplay hash={step.signer} prefixChars={8} suffixChars={8} />
            </div>
          ) : null}
          {step.detail ? (
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Label color="muted" style={{ fontSize: 'var(--text-xs)', width: 60, flexShrink: 0, paddingTop: 2 }}>
                DETAIL
              </Label>
              <Body size="sm" color="secondary">{step.detail}</Body>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})
