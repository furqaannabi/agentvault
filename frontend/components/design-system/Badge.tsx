import React from 'react'

export type BadgeVariant =
  | 'pass'
  | 'fail'
  | 'pending'
  | 'signed'
  | 'verified'
  | 'bullish'
  | 'confirmed'
  | 'settled'
  | 'aborted'
  | 'active'
  | 'syncing'

type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant: BadgeVariant
  label?: string
  size?: BadgeSize
  dot?: boolean
  className?: string
  style?: React.CSSProperties
}

const variantConfig: Record<
  BadgeVariant,
  { label: string; color: string; bg: string; border: string }
> = {
  pass: {
    label:  'PASS',
    color:  'var(--color-accent-teal)',
    bg:     'var(--color-accent-teal-dim)',
    border: 'var(--color-accent-teal)',
  },
  verified: {
    label:  'VERIFIED',
    color:  'var(--color-accent-teal)',
    bg:     'var(--color-accent-teal-dim)',
    border: 'var(--color-accent-teal)',
  },
  active: {
    label:  'ACTIVE',
    color:  'var(--color-accent-teal)',
    bg:     'var(--color-accent-teal-dim)',
    border: 'var(--color-accent-teal)',
  },
  signed: {
    label:  'SIGNED',
    color:  'var(--color-accent-blue)',
    bg:     'var(--color-accent-blue-dim)',
    border: 'var(--color-accent-blue)',
  },
  confirmed: {
    label:  'CONFIRMED',
    color:  'var(--color-accent-blue)',
    bg:     'var(--color-accent-blue-dim)',
    border: 'var(--color-accent-blue)',
  },
  pending: {
    label:  'PENDING',
    color:  'var(--color-accent-amber)',
    bg:     'var(--color-accent-amber-dim)',
    border: 'var(--color-accent-amber)',
  },
  bullish: {
    label:  'BULLISH',
    color:  'var(--color-accent-amber)',
    bg:     'var(--color-accent-amber-dim)',
    border: 'var(--color-accent-amber)',
  },
  syncing: {
    label:  'SYNCING',
    color:  'var(--color-accent-amber)',
    bg:     'var(--color-accent-amber-dim)',
    border: 'var(--color-accent-amber)',
  },
  fail: {
    label:  'FAIL',
    color:  'var(--color-accent-red)',
    bg:     'var(--color-accent-red-dim)',
    border: 'var(--color-accent-red)',
  },
  aborted: {
    label:  'ABORTED',
    color:  'var(--color-accent-red)',
    bg:     'var(--color-accent-red-dim)',
    border: 'var(--color-accent-red)',
  },
  settled: {
    label:  'SETTLED',
    color:  'var(--color-accent-grey)',
    bg:     'var(--color-accent-grey-dim)',
    border: 'var(--color-accent-grey)',
  },
}

const sizeConfig: Record<BadgeSize, React.CSSProperties> = {
  sm: {
    fontSize:      'var(--text-xs)',
    padding:       '2px var(--space-2)',
    letterSpacing: 'var(--tracking-widest)',
  },
  md: {
    fontSize:      'var(--text-sm)',
    padding:       'var(--space-1) var(--space-3)',
    letterSpacing: 'var(--tracking-wider)',
  },
}

export function Badge({
  variant,
  label,
  size = 'sm',
  dot = false,
  className,
  style,
}: BadgeProps) {
  const config = variantConfig[variant]
  const text   = label ?? config.label

  return (
    <span
      className={className}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           'var(--space-1)',
        fontFamily:    'var(--font-mono)',
        fontWeight:    'var(--weight-medium)',
        textTransform: 'uppercase',
        borderRadius:  'var(--radius-sm)',
        border:        `var(--border-width) solid ${config.border}`,
        color:         config.color,
        backgroundColor: config.bg,
        whiteSpace:    'nowrap',
        lineHeight:    'var(--leading-none)',
        ...sizeConfig[size],
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width:           5,
            height:          5,
            borderRadius:    '50%',
            backgroundColor: config.color,
            flexShrink:      0,
          }}
        />
      )}
      {text}
    </span>
  )
}
