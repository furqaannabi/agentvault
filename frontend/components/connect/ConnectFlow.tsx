'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  useAccount,
  useSignTypedData,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { maxUint256, erc20Abi } from 'viem'
import { useRouter } from 'next/navigation'
import { Heading, Body, Label, Mono } from '@/components/design-system/Typography'
import { Badge } from '@/components/design-system/Badge'
import { useSessionStore } from '@/lib/store/sessionStore'
import { getConfig, getPubkey, validateSession } from '@/lib/api'
import type { Config, AgentSession, SignedSession, Hex } from '@/lib/types'

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepDot({ n, current }: { n: number; current: number }) {
  const done    = n < current
  const active  = n === current
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span style={{
        width:           20,
        height:          20,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        border:          `var(--border-width) solid ${active ? 'var(--color-text-primary)' : done ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
        fontFamily:      'var(--font-mono)',
        fontSize:        'var(--text-xs)',
        color:           active ? 'var(--color-text-primary)' : done ? 'var(--color-text-muted)' : 'var(--color-text-muted)',
      }}>
        {done ? '✓' : n}
      </span>
    </div>
  )
}

// ── Token approval row ─────────────────────────────────────────────────────────

interface TokenRowProps {
  token:    Hex
  symbol:   string
  spender:  Hex
  owner:    Hex
  onStatusChange: (token: Hex, approved: boolean) => void
}

function TokenApprovalRow({ token, symbol, spender, owner, onStatusChange }: TokenRowProps) {
  const { data: allowance, refetch } = useReadContract({
    address:      token,
    abi:          erc20Abi,
    functionName: 'allowance',
    args:         [owner, spender],
  })

  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const approved = allowance !== undefined && allowance >= maxUint256 / BigInt(2)

  useEffect(() => {
    if (isSuccess) refetch()
  }, [isSuccess, refetch])

  useEffect(() => {
    onStatusChange(token, approved)
  }, [token, approved, onStatusChange])

  const shortAddr = `${token.slice(0, 6)}…${token.slice(-4)}`

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      padding:      'var(--space-3) var(--space-4)',
      border:       'var(--border-width) solid var(--color-border)',
      backgroundColor: 'var(--color-bg-elevated)',
    }}>
      <Mono size="sm" color={approved ? 'secondary' : 'primary'} as="span">
        {shortAddr} ({symbol})
      </Mono>
      {approved ? (
        <Badge variant="verified" size="sm" dot />
      ) : (
        <button
          onClick={() => writeContract({
            address:      token,
            abi:          erc20Abi,
            functionName: 'approve',
            args:         [spender, maxUint256],
          })}
          disabled={isPending}
          style={{
            padding:         'var(--space-1) var(--space-3)',
            backgroundColor: isPending ? 'transparent' : 'var(--color-text-primary)',
            border:          'var(--border-width) solid var(--color-text-primary)',
            color:           isPending ? 'var(--color-text-muted)' : 'var(--color-bg-base)',
            fontFamily:      'var(--font-mono)',
            fontSize:        'var(--text-xs)',
            letterSpacing:   'var(--tracking-wider)',
            textTransform:   'uppercase',
            cursor:          isPending ? 'default' : 'pointer',
          }}
        >
          {isPending ? 'APPROVING…' : 'APPROVE'}
        </button>
      )}
    </div>
  )
}

// ── ConnectFlow ────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

export function ConnectFlow() {
  const router          = useRouter()
  const { address, isConnected } = useAccount()
  const { signTypedData }        = useSignTypedData()
  const setSession      = useSessionStore((s) => s.setSession)
  const setConfig       = useSessionStore((s) => s.setConfig)

  const [step, setStep]         = useState<Step>(1)
  const [config, setLocalConfig] = useState<Config | null>(null)
  const [pubkey, setPubkey]     = useState<Hex | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  // Session bounds form state
  const [maxTradeUsd,       setMaxTradeUsd]       = useState('500')
  const [maxDailyVolumeUsd, setMaxDailyVolumeUsd] = useState('2000')
  const [maxSlippageBps,    setMaxSlippageBps]     = useState('50')
  const [cooldownSec,       setCooldownSec]        = useState('60')
  const [expiresHours,      setExpiresHours]       = useState('24')

  // Token approval tracking
  const [approvedTokens, setApprovedTokens] = useState<Set<string>>(new Set())

  const handleTokenStatus = useCallback((tokenAddr: Hex, isApproved: boolean) => {
    setApprovedTokens((prev) => {
      const next = new Set(prev)
      if (isApproved) next.add(tokenAddr)
      else next.delete(tokenAddr)
      if (next.size === prev.size) return prev
      return next
    })
  }, [])

  // Advance to step 2 once wallet connected
  useEffect(() => {
    if (isConnected && step === 1) setStep(2)
  }, [isConnected, step])

  // Fetch config when entering step 2
  useEffect(() => {
    if (step !== 2 || config) return
    getConfig()
      .then((c) => { setLocalConfig(c); setConfig(c) })
      .catch((e) => setError(e.message))
  }, [step, config, setConfig])

  const handleSign = useCallback(async () => {
    if (!address || !config) return
    setBusy(true)
    setError(null)
    try {
      const nonce = `0x${Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('')}` as Hex

      const session: AgentSession = {
        user:              address as Hex,
        delegate:          config.delegate,
        chainId:           config.chainId,
        allowedTokens:     config.allowedTokens.map((t) => t.address),
        maxDailyVolumeUsd: Number(maxDailyVolumeUsd),
        maxTradeUsd:       Number(maxTradeUsd),
        maxSlippageBps:    Number(maxSlippageBps),
        cooldownSec:       Number(cooldownSec),
        expiresAt:         Date.now() + Number(expiresHours) * 3_600_000,
        nonce,
      }

      const signature = await new Promise<Hex>((resolve, reject) => {
        signTypedData(
          {
            domain:      config.eip712Domain as Parameters<typeof signTypedData>[0]['domain'],
            types:       config.eip712Types  as Parameters<typeof signTypedData>[0]['types'],
            primaryType: 'AgentSession',
            message:     session as unknown as Record<string, unknown>,
          },
          { onSuccess: resolve, onError: reject },
        )
      })

      const signedSession: SignedSession = { session, signature }
      setSession(signedSession)

      await validateSession()
      setStep(4)

      // Fetch pubkey for token approval
      const pk = await getPubkey()
      setPubkey(pk.signer)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed.')
    } finally {
      setBusy(false)
    }
  }, [address, config, maxTradeUsd, maxDailyVolumeUsd, maxSlippageBps, cooldownSec, expiresHours, signTypedData, setSession])

  const allApproved = config
    ? config.allowedTokens.every((t) => approvedTokens.has(t.address))
    : false

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '100vh',
      padding:        'var(--space-8)',
      backgroundColor: 'var(--color-bg-base)',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-3)' }}>
            AGENTVAULT — SETUP
          </Label>
          <Heading size="2xl">Connect your wallet</Heading>
          <Body size="sm" color="secondary" style={{ marginTop: 'var(--space-2)' }}>
            Non-custodial AI portfolio manager. You keep your keys.
          </Body>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {([1, 2, 3, 4] as Step[]).map((n) => (
            <StepDot key={n} n={n} current={step} />
          ))}
        </div>

        {/* Error banner */}
        {error ? (
          <div style={{
            padding:         'var(--space-3) var(--space-4)',
            border:          'var(--border-width) solid var(--color-accent-red)',
            backgroundColor: 'var(--color-accent-red-dim)',
            marginBottom:    'var(--space-4)',
          }}>
            <Mono size="xs" color="red" as="span">{error}</Mono>
          </div>
        ) : null}

        {/* ── Step 1: Connect wallet ────────────────────────────────── */}
        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>
              STEP 1 — CONNECT WALLET
            </Label>
            <Body size="sm" color="secondary">
              Connect a wallet holding USDC on Ethereum Sepolia.
            </Body>
            <ConnectButton />
          </div>
        ) : null}

        {/* ── Step 2 + 3: Configure + sign session ─────────────────── */}
        {step === 2 || step === 3 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>
              STEP 2 — CONFIGURE SESSION BOUNDS
            </Label>
            <Body size="sm" color="secondary">
              Set the limits the agent must stay within. Signed off-chain — no gas.
            </Body>

            {[
              { label: 'Max trade (USD)',        value: maxTradeUsd,       set: setMaxTradeUsd       },
              { label: 'Max daily volume (USD)',  value: maxDailyVolumeUsd, set: setMaxDailyVolumeUsd },
              { label: 'Max slippage (bps)',      value: maxSlippageBps,    set: setMaxSlippageBps    },
              { label: 'Cooldown (seconds)',      value: cooldownSec,       set: setCooldownSec       },
              { label: 'Expires in (hours)',      value: expiresHours,      set: setExpiresHours      },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>
                  {label.toUpperCase()}
                </Label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  style={{
                    width:           '100%',
                    padding:         'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-bg-elevated)',
                    border:          'var(--border-width) solid var(--color-border)',
                    color:           'var(--color-text-primary)',
                    fontFamily:      'var(--font-mono)',
                    fontSize:        'var(--text-base)',
                    outline:         'none',
                  }}
                />
              </div>
            ))}

            {config ? (
              <div>
                <Label color="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--space-1)' }}>
                  ALLOWED TOKENS
                </Label>
                {config.allowedTokens.map((t) => (
                  <Mono key={t.address} size="xs" color="secondary" as="p" style={{ margin: '2px 0' }}>
                    {t.symbol} — {t.address}
                  </Mono>
                ))}
              </div>
            ) : null}

            <button
              onClick={handleSign}
              disabled={busy || !config}
              style={{
                padding:         'var(--space-3) var(--space-4)',
                backgroundColor: busy || !config ? 'transparent' : 'var(--color-text-primary)',
                border:          'var(--border-width) solid var(--color-text-primary)',
                color:           busy || !config ? 'var(--color-text-muted)' : 'var(--color-bg-base)',
                fontFamily:      'var(--font-mono)',
                fontSize:        'var(--text-xs)',
                letterSpacing:   'var(--tracking-wider)',
                textTransform:   'uppercase',
                cursor:          busy || !config ? 'default' : 'pointer',
                width:           '100%',
              }}
            >
              {busy ? 'SIGNING…' : 'SIGN SESSION →'}
            </button>
          </div>
        ) : null}

        {/* ── Step 4: Approve tokens ────────────────────────────────── */}
        {step === 4 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Label color="primary" style={{ fontSize: 'var(--text-xs)' }}>
              STEP 4 — APPROVE TOKENS
            </Label>
            <Body size="sm" color="secondary">
              Grant the delegate allowance to swap on your behalf. One approval per token.
            </Body>

            {config && pubkey && address ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {config.allowedTokens.map((token) => (
                  <TokenApprovalRow
                    key={token.address}
                    token={token.address}
                    symbol={token.symbol}
                    spender={pubkey}
                    owner={address as Hex}
                    onStatusChange={handleTokenStatus}
                  />
                ))}
              </div>
            ) : (
              <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>Loading token list…</Label>
            )}

            <button
              onClick={() => router.push('/')}
              disabled={!allApproved}
              style={{
                padding:         'var(--space-3) var(--space-4)',
                backgroundColor: allApproved ? 'var(--color-text-primary)' : 'transparent',
                border:          'var(--border-width) solid var(--color-border-strong)',
                color:           allApproved ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
                fontFamily:      'var(--font-mono)',
                fontSize:        'var(--text-xs)',
                letterSpacing:   'var(--tracking-wider)',
                textTransform:   'uppercase',
                cursor:          allApproved ? 'pointer' : 'default',
                width:           '100%',
              }}
            >
              ENTER APP →
            </button>

            {!allApproved ? (
              <Body size="sm" color="muted" style={{ textAlign: 'center' }}>
                Approve all tokens above to continue.
              </Body>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
