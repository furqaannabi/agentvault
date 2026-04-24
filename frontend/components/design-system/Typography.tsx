import React from 'react'

type ColorVariant = 'primary' | 'secondary' | 'muted' | 'teal' | 'amber' | 'red'

const colorMap: Record<ColorVariant, string> = {
  primary:   'var(--color-text-primary)',
  secondary: 'var(--color-text-secondary)',
  muted:     'var(--color-text-muted)',
  teal:      'var(--color-accent-teal)',
  amber:     'var(--color-accent-amber)',
  red:       'var(--color-accent-red)',
}

// ── Heading ───────────────────────────────────────────────────────
// Page titles ("Decision Log // REV_11"), section headers ("Policy Engine")
// Uses Syne display font with tight tracking

type HeadingSize = '4xl' | '3xl' | '2xl' | 'xl' | 'lg'

interface HeadingProps {
  children: React.ReactNode
  size?: HeadingSize
  color?: ColorVariant
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div'
  className?: string
  style?: React.CSSProperties
}

const headingSizeMap: Record<HeadingSize, React.CSSProperties> = {
  '4xl': { fontSize: 'var(--text-4xl)', lineHeight: 'var(--leading-none)'  },
  '3xl': { fontSize: 'var(--text-3xl)', lineHeight: 'var(--leading-tight)' },
  '2xl': { fontSize: 'var(--text-2xl)', lineHeight: 'var(--leading-tight)' },
  'xl':  { fontSize: 'var(--text-xl)',  lineHeight: 'var(--leading-snug)'  },
  'lg':  { fontSize: 'var(--text-lg)',  lineHeight: 'var(--leading-snug)'  },
}

export function Heading({
  children,
  size = '2xl',
  color = 'primary',
  as: Tag = 'h2',
  className,
  style,
}: HeadingProps) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily:    'var(--font-display)',
        fontWeight:    'var(--weight-bold)',
        letterSpacing: 'var(--tracking-tight)',
        color:         colorMap[color],
        margin:        0,
        ...headingSizeMap[size],
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

// ── Body ──────────────────────────────────────────────────────────
// Prose, descriptions, explanations
// Uses DM Sans at readable leading

type BodySize = 'md' | 'base' | 'sm'

interface BodyProps {
  children: React.ReactNode
  size?: BodySize
  color?: ColorVariant
  as?: 'p' | 'span' | 'div' | 'li'
  className?: string
  style?: React.CSSProperties
}

const bodySizeMap: Record<BodySize, React.CSSProperties> = {
  md:   { fontSize: 'var(--text-md)',   lineHeight: 'var(--leading-normal)' },
  base: { fontSize: 'var(--text-base)', lineHeight: 'var(--leading-normal)' },
  sm:   { fontSize: 'var(--text-sm)',   lineHeight: 'var(--leading-snug)'   },
}

export function Body({
  children,
  size = 'base',
  color = 'secondary',
  as: Tag = 'p',
  className,
  style,
}: BodyProps) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily:    'var(--font-body)',
        fontWeight:    'var(--weight-regular)',
        letterSpacing: 'var(--tracking-normal)',
        color:         colorMap[color],
        margin:        0,
        ...bodySizeMap[size],
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

// ── Mono ──────────────────────────────────────────────────────────
// Hashes, IDs, timestamps, addresses, on-chain data
// Uses JetBrains Mono with wide tracking

type MonoSize = 'md' | 'base' | 'sm' | 'xs'

interface MonoProps {
  children: React.ReactNode
  size?: MonoSize
  color?: ColorVariant
  as?: 'span' | 'p' | 'div' | 'code' | 'samp' | 'data'
  className?: string
  style?: React.CSSProperties
}

const monoSizeMap: Record<MonoSize, React.CSSProperties> = {
  md:   { fontSize: 'var(--text-md)',   lineHeight: 'var(--leading-snug)'  },
  base: { fontSize: 'var(--text-base)', lineHeight: 'var(--leading-snug)'  },
  sm:   { fontSize: 'var(--text-sm)',   lineHeight: 'var(--leading-snug)'  },
  xs:   { fontSize: 'var(--text-xs)',   lineHeight: 'var(--leading-tight)' },
}

export function Mono({
  children,
  size = 'sm',
  color = 'secondary',
  as: Tag = 'span',
  className,
  style,
}: MonoProps) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily:    'var(--font-mono)',
        fontWeight:    'var(--weight-regular)',
        letterSpacing: 'var(--tracking-wide)',
        color:         colorMap[color],
        ...monoSizeMap[size],
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

// ── Label ─────────────────────────────────────────────────────────
// Column headers (STAGE, STATUS), sidebar nav (DECISION LOG),
// badge text — always uppercase, widest tracking, smallest size

interface LabelProps {
  children: React.ReactNode
  color?: ColorVariant
  as?: 'span' | 'p' | 'div' | 'dt' | 'th' | 'label'
  className?: string
  style?: React.CSSProperties
}

export function Label({
  children,
  color = 'muted',
  as: Tag = 'span',
  className,
  style,
}: LabelProps) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily:    'var(--font-mono)',
        fontWeight:    'var(--weight-medium)',
        fontSize:      'var(--text-xs)',
        lineHeight:    'var(--leading-tight)',
        letterSpacing: 'var(--tracking-widest)',
        textTransform: 'uppercase',
        color:         colorMap[color],
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}
