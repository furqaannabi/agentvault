'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { approveProposal } from '@/lib/api'
import type { TradeProposal, Proof } from '@/lib/types'

interface ApprovalPromptProps {
  proposal:   TradeProposal
  onApproved: (proof: Proof) => void
  onRejected: () => void
}

function formatSlippage(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

type Status = 'pending' | 'approving' | 'rejecting' | 'done'

export function ApprovalPrompt({
  proposal,
  onApproved,
  onRejected,
}: ApprovalPromptProps) {
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError]   = useState<string | null>(null)

  const busy = status === 'approving' || status === 'rejecting'

  async function handleApprove() {
    if (busy) return
    setStatus('approving')
    setError(null)
    try {
      const proof = await approveProposal(proposal.id)
      setStatus('done')
      onApproved(proof)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed.')
      setStatus('pending')
    }
  }

  function handleReject() {
    if (busy) return
    setStatus('done')
    onRejected()
  }

  return (
    <div style={{ padding: 'var(--space-2) var(--space-6)' }}>
      <motion.div
        animate={{
          boxShadow: [
            '0 0 0 1px var(--color-accent-amber)',
            '0 0 0 3px var(--color-accent-amber-dim)',
            '0 0 0 1px var(--color-accent-amber)',
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          border:          '1px solid var(--color-accent-amber)',
          backgroundColor: 'var(--color-bg-surface)',
          maxWidth:        640,
        }}
      >
        {/* Header */}
        <div
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            padding:         'var(--space-3) var(--space-4)',
            borderBottom:    '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-elevated)',
          }}
        >
          <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>
            APPROVAL REQUIRED
          </Label>
          <Badge variant="pending" size="sm" />
        </div>

        {/* Trade summary */}
        <div style={{ padding: 'var(--space-5) var(--space-4)' }}>
          {/* Trade action — large */}
          <Heading
            size="xl"
            style={{
              letterSpacing: 'var(--tracking-tight)',
              marginBottom:  'var(--space-2)',
            }}
          >
            SWAP {proposal.amountIn} {proposal.tokenIn} → {proposal.tokenOut}
          </Heading>

          {/* Trade metadata */}
          <div
            style={{
              display:    'flex',
              gap:        'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <Mono size="xs" color="muted" as="span">
              Max slippage: {formatSlippage(proposal.maxSlippageBps)}
            </Mono>
            <Mono size="xs" color="muted" as="span">
              Sepolia
            </Mono>
            <Mono size="xs" color="muted" as="span">
              {new Date(proposal.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false,
              })}
            </Mono>
          </div>

          {/* Reasoning */}
          <div
            style={{
              borderLeft:  '2px solid var(--color-border-strong)',
              paddingLeft: 'var(--space-3)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>
              REASONING
            </Label>
            <Body size="sm" color="secondary">
              {proposal.reasoning}
            </Body>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding:         'var(--space-2) var(--space-3)',
                border:          '1px solid var(--color-accent-red)',
                backgroundColor: 'var(--color-accent-red-dim)',
                marginBottom:    'var(--space-4)',
              }}
            >
              <Mono size="xs" color="red" as="span">{error}</Mono>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {/* Approve */}
            <button
              onClick={handleApprove}
              disabled={busy}
              style={{
                flex:            1,
                padding:         'var(--space-3) var(--space-4)',
                backgroundColor: busy && status === 'approving'
                  ? 'var(--color-bg-elevated)'
                  : 'var(--color-text-primary)',
                border:          '1px solid var(--color-text-primary)',
                color:           busy && status === 'approving'
                  ? 'var(--color-text-muted)'
                  : 'var(--color-bg-base)',
                cursor:          busy ? 'default' : 'pointer',
                transition:      'background var(--duration-fast) var(--ease-out)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             'var(--space-2)',
              }}
            >
              <Label style={{ fontSize: 'var(--text-xs)', color: 'inherit' }}>
                {status === 'approving' ? 'EXECUTING…' : 'APPROVE'}
              </Label>
              {status !== 'approving' && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'inherit' }}>→</span>
              )}
            </button>

            {/* Reject */}
            <button
              onClick={handleReject}
              disabled={busy}
              style={{
                flex:            1,
                padding:         'var(--space-3) var(--space-4)',
                backgroundColor: 'transparent',
                border:          '1px solid var(--color-border-strong)',
                color:           busy && status === 'rejecting'
                  ? 'var(--color-text-muted)'
                  : 'var(--color-text-secondary)',
                cursor:          busy ? 'default' : 'pointer',
                transition:      'border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.borderColor = 'var(--color-accent-red)'
                  e.currentTarget.style.color = 'var(--color-accent-red)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-strong)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
            >
              <Label style={{ fontSize: 'var(--text-xs)', color: 'inherit' }}>
                {status === 'rejecting' ? 'ABORTING…' : 'REJECT'}
              </Label>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
