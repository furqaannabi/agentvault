'use client'

import React, { useState } from 'react'
import { Label, Mono, Body } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { HashDisplay } from '@/components/design-system/HashDisplay'
import type { PolicyVerdict, PolicyRule } from '@/lib/types'

// ── Rule row ───────────────────────────────────────────────────────────────────

interface RuleRowProps {
  rule:  PolicyRule
  index: number
}

function RuleRow({ rule, index }: RuleRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!rule.detail

  return (
    <div
      style={{
        borderBottom: 'var(--border-width) solid var(--color-border-subtle)',
      }}
    >
      {/* Main row */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          padding:        'var(--space-3) var(--space-4)',
          gap:            'var(--space-3)',
          cursor:         hasDetail ? 'pointer' : 'default',
        }}
        onClick={() => hasDetail && setExpanded((v) => !v)}
        role={hasDetail ? 'button' : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        {/* Index */}
        <Mono size="xs" color="muted" as="span" style={{ width: 20, flexShrink: 0, textAlign: 'right' }}>
          {String(index + 1).padStart(2, '0')}
        </Mono>

        {/* Status icon */}
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize:   'var(--text-sm)',
            color:      rule.pass
              ? 'var(--color-accent-teal)'
              : 'var(--color-accent-red)',
            lineHeight: 1,
          }}
        >
          {rule.pass ? '✓' : '✗'}
        </span>

        {/* Rule name */}
        <Mono
          size="sm"
          color={rule.pass ? 'primary' : 'red'}
          as="span"
          style={{ flex: 1, textTransform: 'uppercase' }}
        >
          {rule.id}
        </Mono>

        {/* Badge */}
        <Badge variant={rule.pass ? 'pass' : 'fail'} size="sm" />

        {/* Expand toggle */}
        {hasDetail && (
          <Mono size="xs" color="muted" as="span" style={{ flexShrink: 0 }}>
            {expanded ? '[ − ]' : '[ + ]'}
          </Mono>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && rule.detail && (
        <div
          style={{
            padding:         'var(--space-2) var(--space-4) var(--space-3)',
            paddingLeft:     `calc(var(--space-4) + 20px + var(--space-3) + 16px + var(--space-3))`,
            backgroundColor: 'var(--color-bg-inset)',
            borderTop:       'var(--border-width) solid var(--color-border-subtle)',
          }}
        >
          <Body size="sm" color="secondary">
            {rule.detail}
          </Body>
        </div>
      )}
    </div>
  )
}

// ── PolicyChecklist ────────────────────────────────────────────────────────────

interface PolicyChecklistProps {
  verdict: PolicyVerdict
}

export function PolicyChecklist({ verdict }: PolicyChecklistProps) {
  const passCount = verdict.rules.filter((r) => r.pass).length
  const total     = verdict.rules.length

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
          POLICY VERDICT
        </Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Mono size="xs" color="muted" as="span">
            {passCount}/{total} PASSED
          </Mono>
          <Badge variant={verdict.ok ? 'pass' : 'fail'} size="sm" dot />
        </div>
      </div>

      {/* Rule rows */}
      <div>
        {verdict.rules.map((rule, i) => (
          <RuleRow key={rule.id} rule={rule} index={i} />
        ))}
      </div>

      {/* Footer — attestation hashes */}
      <div
        style={{
          borderTop:       'var(--border-width) solid var(--color-border)',
          backgroundColor: 'var(--color-bg-elevated)',
          padding:         'var(--space-3) var(--space-4)',
          display:         'flex',
          flexDirection:   'column',
          gap:             'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Label color="muted" style={{ fontSize: 'var(--text-xs)', width: 100, flexShrink: 0 }}>
            SIGNER
          </Label>
          <HashDisplay hash={verdict.signer} prefixChars={6} suffixChars={6} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Label color="muted" style={{ fontSize: 'var(--text-xs)', width: 100, flexShrink: 0 }}>
            SIGNATURE
          </Label>
          <HashDisplay hash={verdict.sig} prefixChars={6} suffixChars={6} />
        </div>
      </div>
    </div>
  )
}
