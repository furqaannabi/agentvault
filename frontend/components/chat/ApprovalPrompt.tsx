'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { formatTokenAmount, tokenSymbol } from '@/lib/format'
import {
  type ExecStage,
  type ExecStageEvent,
  approveProposal,
  approveProposalStream,
} from '@/lib/api'
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

// 4-step progress strip. Stages from the backend SSE collapse onto these:
//   POLICY_CHECK         → 'policy'
//   SUBMITTING (any)     → 'submit'
//   BROADCAST  (any)     → 'broadcast'
//   CONFIRMING           → 'confirm'
//   SETTLED / FAILED     → terminal (strip hides; proof view replaces it)
type StripStep = 'policy' | 'submit' | 'broadcast' | 'confirm'
const STRIP_ORDER: StripStep[] = ['policy', 'submit', 'broadcast', 'confirm']
const STRIP_LABEL: Record<StripStep, string> = {
  policy:    'POLICY',
  submit:    'SUBMIT',
  broadcast: 'BROADCAST',
  confirm:   'CONFIRM',
}

function stageToStep(stage: ExecStage): StripStep | null {
  switch (stage) {
    case 'POLICY_CHECK': return 'policy'
    case 'SUBMITTING':   return 'submit'
    case 'BROADCAST':    return 'broadcast'
    case 'CONFIRMING':   return 'confirm'
    default:             return null
  }
}

function ProgressStrip({
  reachedIndex,
  jobIds,
  attempts,
}: {
  reachedIndex: number
  jobIds:       Partial<Record<'approval' | 'swap', string>>
  attempts?:    number
}) {
  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'stretch',
        gap:            'var(--space-2)',
        padding:        'var(--space-3)',
        border:         '1px solid var(--color-accent-blue)',
        backgroundColor: 'var(--color-accent-blue-dim)',
        marginBottom:   'var(--space-4)',
      }}
    >
      {STRIP_ORDER.map((step, i) => {
        const reached = i <= reachedIndex
        const active  = i === reachedIndex
        return (
          <div
            key={step}
            style={{
              flex:        1,
              display:     'flex',
              flexDirection: 'column',
              gap:         'var(--space-1)',
              alignItems:  'flex-start',
              padding:     'var(--space-2)',
              borderLeft:  active
                ? '2px solid var(--color-accent-blue)'
                : '2px solid transparent',
              opacity:     reached ? 1 : 0.35,
              transition:  'opacity var(--duration-base) var(--ease-out)',
            }}
          >
            <Label
              color={reached ? 'primary' : 'muted'}
              style={{ fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-widest)' }}
            >
              {String(i + 1).padStart(2, '0')} · {STRIP_LABEL[step]}
            </Label>
            {active && (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width:  6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent-blue)',
                }}
              />
            )}
            {step === 'broadcast' && jobIds.approval && (
              <Mono size="xs" color="muted" as="span">
                approval · {jobIds.approval.slice(0, 12)}…
              </Mono>
            )}
            {step === 'broadcast' && jobIds.swap && (
              <Mono size="xs" color="muted" as="span">
                swap · {jobIds.swap.slice(0, 12)}…
              </Mono>
            )}
            {step === 'confirm' && typeof attempts === 'number' && (
              <Mono size="xs" color="muted" as="span">
                attempts · {attempts}
              </Mono>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ApprovalPrompt({
  proposal,
  onApproved,
  onRejected,
}: ApprovalPromptProps) {
  const [status, setStatus]             = useState<Status>('pending')
  const [error, setError]               = useState<string | null>(null)
  const [reachedIndex, setReachedIndex] = useState<number>(-1)
  const [jobIds, setJobIds]             = useState<Partial<Record<'approval' | 'swap', string>>>({})
  const [attempts, setAttempts]         = useState<number | undefined>(undefined)

  const config = useSessionStore((s) => s.config)
  const useStream = config?.executionLayer === 'keeperhub'

  const busy = status === 'approving' || status === 'rejecting'

  const tokens          = config?.allowedTokens ?? []
  const tIn             = tokens.find((t) => t.address.toLowerCase() === proposal.tokenIn.toLowerCase())
  const inSymbol        = tokenSymbol(proposal.tokenIn,  tokens)
  const outSymbol       = tokenSymbol(proposal.tokenOut, tokens)
  const formattedAmount = tIn
    ? formatTokenAmount(proposal.amountIn, tIn.decimals)
    : proposal.amountIn

  function handleStage(event: ExecStageEvent) {
    const step = stageToStep(event.stage)
    if (step) {
      const idx = STRIP_ORDER.indexOf(step)
      setReachedIndex((prev) => Math.max(prev, idx))
    }
    if (event.stage === 'BROADCAST' && event.step) {
      const jobId = (event.payload as { jobId?: string } | undefined)?.jobId
      if (jobId) {
        setJobIds((prev) => ({ ...prev, [event.step!]: jobId }))
      }
    }
    if (event.stage === 'BROADCAST' || event.stage === 'SETTLED') {
      const a = (event.payload as { attempts?: number } | undefined)?.attempts
      if (typeof a === 'number') setAttempts(a)
    }
  }

  async function handleApprove() {
    if (busy) return
    setStatus('approving')
    setError(null)
    setReachedIndex(-1)
    setJobIds({})
    setAttempts(undefined)

    try {
      // Demo flag is opt-in via URL: ?demo=force-retry. Documented in README.
      const demoParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('demo')
          : null
      const demo = demoParam === 'force-retry' ? 'force-retry' : undefined

      const proof = useStream
        ? await approveProposalStream(proposal.id, {
            onStage: handleStage,
            demo,
          })
        : await approveProposal(proposal.id)
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
          {/* Status indicator */}
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

          {/* SSE progress strip — visible only while streaming */}
          {status === 'approving' && useStream && (
            <ProgressStrip
              reachedIndex={reachedIndex}
              jobIds={jobIds}
              attempts={attempts}
            />
          )}

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
