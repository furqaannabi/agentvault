'use client'

import React, { useState, useCallback } from 'react'

interface HashDisplayProps {
  hash: string
  prefixChars?: number
  suffixChars?: number
  showCopy?: boolean
  className?: string
  style?: React.CSSProperties
}

function truncateHash(hash: string, prefix: number, suffix: number): string {
  if (!hash) return ''
  const hasHexPrefix = hash.startsWith('0x') || hash.startsWith('0X')
  const body = hasHexPrefix ? hash.slice(2) : hash
  const displayPrefix = hasHexPrefix ? '0x' : ''
  if (body.length <= prefix + suffix) return hash
  return `${displayPrefix}${body.slice(0, prefix)}…${body.slice(-suffix)}`
}

export function HashDisplay({
  hash,
  prefixChars = 4,
  suffixChars = 4,
  showCopy = true,
  className,
  style,
}: HashDisplayProps) {
  const [copied, setCopied]       = useState(false)
  const [showFull, setShowFull]   = useState(false)

  const truncated = truncateHash(hash, prefixChars, suffixChars)
  const isLong    = truncated !== hash

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }, [hash])

  return (
    <span
      className={className}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        'var(--space-2)',
        ...style,
      }}
    >
      {/* Hash text */}
      <span
        title={isLong ? hash : undefined}
        style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      'var(--text-sm)',
          letterSpacing: 'var(--tracking-wide)',
          color:         'var(--color-text-secondary)',
          cursor:        isLong ? 'default' : undefined,
          userSelect:    'text',
        }}
      >
        {showFull ? hash : truncated}
      </span>

      {/* Expand/collapse toggle for long hashes */}
      {isLong && (
        <button
          onClick={() => setShowFull((v) => !v)}
          title={showFull ? 'Collapse' : 'Show full hash'}
          style={{
            background:    'none',
            border:        'none',
            padding:       '0 var(--space-1)',
            cursor:        'pointer',
            fontFamily:    'var(--font-mono)',
            fontSize:      'var(--text-xs)',
            letterSpacing: 'var(--tracking-wider)',
            color:         'var(--color-text-muted)',
            textTransform: 'uppercase',
            lineHeight:    1,
            transition:    `color var(--duration-fast) var(--ease-out)`,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-secondary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-muted)'
          }}
        >
          {showFull ? '[ − ]' : '[ + ]'}
        </button>
      )}

      {/* Copy button */}
      {showCopy && (
        <button
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy hash'}
          aria-label={copied ? 'Copied' : 'Copy hash to clipboard'}
          style={{
            background:    'none',
            border:        'none',
            padding:       '0 var(--space-1)',
            cursor:        'pointer',
            fontFamily:    'var(--font-mono)',
            fontSize:      'var(--text-xs)',
            letterSpacing: 'var(--tracking-wider)',
            color:         copied
              ? 'var(--color-accent-teal)'
              : 'var(--color-text-muted)',
            textTransform: 'uppercase',
            lineHeight:    1,
            transition:    `color var(--duration-fast) var(--ease-out)`,
            whiteSpace:    'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              ;(e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-secondary)'
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              ;(e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-muted)'
            }
          }}
        >
          {copied ? '✓ COPIED' : 'COPY'}
        </button>
      )}
    </span>
  )
}
