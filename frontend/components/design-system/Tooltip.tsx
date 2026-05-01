'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Body } from '@/components/design-system/Typography'

interface TooltipProps {
  content:  string
  children: React.ReactNode
  side?:    'top' | 'bottom' | 'right'
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisible(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  const offset = side === 'top' ? { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
               : side === 'bottom' ? { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
               : { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}

      <AnimatePresence>
        {visible ? (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : side === 'bottom' ? -4 : 0, x: side === 'right' ? -4 : 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            style={{
              position:        'absolute',
              zIndex:          'var(--z-tooltip)',
              maxWidth:        220,
              padding:         'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bg-elevated)',
              border:          'var(--border-width) solid var(--color-border-strong)',
              pointerEvents:   'none',
              whiteSpace:      'normal',
              ...offset,
            }}
          >
            <Body size="sm" color="secondary" style={{ margin: 0, lineHeight: 1.4 }}>
              {content}
            </Body>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  )
}

// ── Info icon with tooltip ─────────────────────────────────────────────────────

interface InfoTipProps {
  content: string
  side?:   TooltipProps['side']
}

export function InfoTip({ content, side }: InfoTipProps) {
  return (
    <Tooltip content={content} side={side}>
      <span
        tabIndex={0}
        aria-label="More info"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          14,
          height:         14,
          borderRadius:   '50%',
          border:         'var(--border-width) solid var(--color-text-muted)',
          fontFamily:     'var(--font-mono)',
          fontSize:       9,
          color:          'var(--color-text-muted)',
          cursor:         'default',
          flexShrink:     0,
          lineHeight:     1,
          userSelect:     'none',
        }}
      >
        ?
      </span>
    </Tooltip>
  )
}
