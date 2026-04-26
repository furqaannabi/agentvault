'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { getPortfolio } from '@/lib/api'
import type { Portfolio, Balance } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatAmount(amount: string, decimals: number): string {
  try {
    const raw     = BigInt(amount)
    const divisor = 10n ** BigInt(decimals)
    const whole   = raw / divisor
    const frac    = raw % divisor
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4)
    return `${whole}.${fracStr}`
  } catch {
    return amount
  }
}

// ── Skeleton row ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      padding:      'var(--space-4)',
      borderBottom: 'var(--border-width) solid var(--color-border-subtle)',
    }}>
      <div style={{ height: 10, width: '25%', backgroundColor: 'var(--color-bg-elevated)' }} />
      <div style={{ height: 10, width: '20%', backgroundColor: 'var(--color-bg-elevated)' }} />
    </div>
  )
}

// ── Balance row ────────────────────────────────────────────────────────────────

function BalanceRow({ balance }: { balance: Balance }) {
  const isNative  = balance.address === 'native'
  const formatted = formatAmount(balance.amount, balance.decimals)

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        'var(--space-4)',
      borderBottom:   'var(--border-width) solid var(--color-border-subtle)',
    }}>
      <div>
        <Label color="primary" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>
          {balance.symbol}
        </Label>
        {!isNative ? (
          <Mono size="xs" color="muted" as="span">
            {`${balance.address.slice(0, 6)}…${balance.address.slice(-4)}`}
          </Mono>
        ) : (
          <Mono size="xs" color="muted" as="span">native</Mono>
        )}
      </div>
      <Mono size="base" color="primary" as="span">
        {formatted}
      </Mono>
    </div>
  )
}

// ── PortfolioView ──────────────────────────────────────────────────────────────

export function PortfolioView() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchPortfolio = useCallback(() => {
    setLoading(true)
    setError(null)
    getPortfolio()
      .then(setPortfolio)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPortfolio() }, [fetchPortfolio])

  // Sort: native first, then alphabetical by symbol
  const sorted = portfolio
    ? [...portfolio.balances].sort((a, b) => {
        if (a.address === 'native') return -1
        if (b.address === 'native') return 1
        return a.symbol.localeCompare(b.symbol)
      })
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Heading size="2xl">Portfolio</Heading>
          {portfolio ? (
            <Mono size="xs" color="muted" as="p" style={{ marginTop: 'var(--space-1)' }}>
              {`${portfolio.user.slice(0, 8)}…${portfolio.user.slice(-6)}`}
            </Mono>
          ) : null}
        </div>
        <button
          onClick={fetchPortfolio}
          disabled={loading}
          style={{
            padding:       'var(--space-2) var(--space-3)',
            background:    'transparent',
            border:        'var(--border-width) solid var(--color-border-strong)',
            cursor:        loading ? 'default' : 'pointer',
            fontFamily:    'var(--font-mono)',
            fontSize:      'var(--text-xs)',
            letterSpacing: 'var(--tracking-wider)',
            textTransform: 'uppercase',
            color:         loading ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
          }}
        >
          {loading ? '…' : '↻ REFRESH'}
        </button>
      </div>

      {/* Balances card */}
      <div style={{ border: 'var(--border-width) solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}>
        {/* Column headers */}
        <div style={{
          display:             'flex',
          justifyContent:      'space-between',
          padding:             'var(--space-2) var(--space-4)',
          borderBottom:        'var(--border-width) solid var(--color-border)',
          backgroundColor:     'var(--color-bg-elevated)',
        }}>
          <Label color="secondary" style={{ fontSize: 'var(--text-xs)' }}>TOKEN</Label>
          <Label color="secondary" style={{ fontSize: 'var(--text-xs)' }}>BALANCE</Label>
        </div>

        {/* Loading */}
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : null}

        {/* Error */}
        {!loading && error ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <Mono size="xs" color="red" as="span">{error}</Mono>
          </div>
        ) : null}

        {/* Empty */}
        {!loading && !error && sorted.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>NO BALANCES</Label>
            <Body size="sm" color="muted" style={{ marginTop: 'var(--space-2)' }}>
              Fund your wallet with tokens on Base Sepolia.
            </Body>
          </div>
        ) : null}

        {/* Populated */}
        {!loading && !error && sorted.length > 0 ? (
          sorted.map((b) => <BalanceRow key={b.address} balance={b} />)
        ) : null}
      </div>

      {portfolio ? (
        <Mono size="xs" color="muted" as="p" style={{ textAlign: 'right' }}>
          Updated {new Date(portfolio.updatedAt).toLocaleTimeString()}
        </Mono>
      ) : null}
    </div>
  )
}
