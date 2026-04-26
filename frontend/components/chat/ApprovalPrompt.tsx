'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { approveProposal } from '@/lib/api'
import { useSessionStore } from '@/lib/store/sessionStore'
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

  const config = useSessionStore((s) => s.config)

  const busy = status === 'approving' || status === 'rejecting'

  // Resolve token metadata
  const tIn  = config?.allowedTokens.find((t) => t.address.toLowerCase() === proposal.tokenIn.toLowerCase())
  const tOut = config?.allowedTokens.find((t) => t.address.toLowerCase() === proposal.tokenOut.toLowerCase())

  const inSymbol  = tIn?.symbol ?? `${proposal.tokenIn.slice(0, 6)}…`
  const outSymbol = tOut?.symbol ?? `${proposal.tokenOut.slice(0, 6)}…`

  // Format amount based on decimals
  let formattedAmount = proposal.amountIn
  if (tIn) {
    try {
      const raw = BigInt(proposal.amountIn)
      const divisor = 10n ** BigInt(tIn.decimals)
      const whole = raw / divisor
      const frac = raw % divisor
      const fracStr = frac.toString().padStart(tIn.decimals, '0').slice(0, 4).replace(/0+$/, '')
      formattedAmount = fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`
    } catch {
      // Fallback
    }
  }

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

  const getStatusColor = () => {
    if (status === 'approving') return 'var(--color-accent-teal)'
    if (status === 'rejecting') return 'var(--color-accent-red)'
    if (status === 'done') return 'var(--color-accent-blue)'
    return 'var(--color-accent-amber)'
  }

  const dotColor = getStatusColor()

  return (
    <div style={{ padding: 'var(--space-2) var(--space-6)' }}>
      <div
        style={{
          border:          '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
          maxWidth:        640,
        }}
      >
        <div style={{ padding: 'var(--space-5) var(--space-4)', position: 'relative' }}>
          {/* Minimalist Status Indicator */}
          <div style={{ position: 'absolute', top: 'var(--space-5)', right: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Label color="muted" style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              {status === 'pending' ? 'APPROVAL REQUIRED' : status === 'approving' ? 'EXECUTING' : status === 'rejecting' ? 'ABORTING' : 'SETTLED'}
            </Label>
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: dotColor,
                boxShadow: `0 0 8px ${dotColor}`,
                flexShrink: 0,
              }}
            />
          </div>

          {/* Trade action — large */}
          <Heading
            size="xl"
            style={{
              letterSpacing: 'var(--tracking-tight)',
              marginBottom:  'var(--space-2)',
            }}
          >
            SWAP {formattedAmount} {inSymbol} → {outSymbol}
          </Heading>

          {/* Trade metadata */}
          <div
            style={{
              display:    'flex',
              gap:        'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <Mono size="xs" color="secondary" as="span">
              Max slippage: {formatSlippage(proposal.maxSlippageBps)}
            </Mono>
            <Mono size="xs" color="muted" as="span">
              Ethereum Sepolia
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
          {error ? (
            <div
              style={{
                padding:         'var(--space-3)',
                border:          '1px solid var(--color-accent-red)',
                backgroundColor: 'var(--color-accent-red-dim)',
                marginBottom:    'var(--space-4)',
                display:         'flex',
                flexDirection:   'column',
                gap:             'var(--space-2)',
              }}
            >
              <Mono size="xs" color="red" as="span">{error}</Mono>
              {error.toLowerCase().includes('allowance') || error.toLowerCase().includes('re-approve') ? (
                <a
                  href="/connect"
                  style={{
                    fontFamily:    'var(--font-mono)',
                    fontSize:      'var(--text-xs)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                    color:         'var(--color-accent-amber)',
                    textDecoration: 'none',
                  }}
                >
                  → Go to token approval →
                </a>
              ) : null}
            </div>
          ) : null}

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
      </div>
    </div>
  )
}
