'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Label, Mono } from '@/components/design-system/Typography'
import type { MessageRole } from '@/lib/types'

interface MessageBubbleProps {
  role:        MessageRole
  content:     string
  timestamp:   number
  isStreaming?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ── Streaming cursor ───────────────────────────────────────────────────────────

function StreamCursor() {
  return (
    <motion.span
      aria-hidden
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{
        display:    'inline-block',
        fontFamily: 'var(--font-mono)',
        fontSize:   'var(--text-base)',
        color:      'var(--color-accent-teal)',
        marginLeft: 2,
        lineHeight: 1,
      }}
    >
      ▊
    </motion.span>
  )
}

// ── MessageBubble ──────────────────────────────────────────────────────────────

export function MessageBubble({
  role,
  content,
  timestamp,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div
      style={{
        display:       'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding:       'var(--space-2) var(--space-6)',
      }}
    >
      <div
        style={{
          maxWidth:   '72%',
          minWidth:   120,
          display:    'flex',
          flexDirection: 'column',
          gap:        'var(--space-2)',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Label row */}
        <div
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        'var(--space-3)',
          }}
        >
          <Label
            color="muted"
            style={{ fontSize: 'var(--text-xs)' }}
          >
            {isUser ? 'YOU' : 'PROOFTWIN'}
          </Label>
          <time dateTime={new Date(timestamp).toISOString()}>
            <Mono size="xs" color="muted" as="span">
              {formatTime(timestamp)}
            </Mono>
          </time>
        </div>

        {/* Message body */}
        <div
          style={{
            backgroundColor: isUser
              ? 'var(--color-bg-elevated)'
              : 'var(--color-bg-surface)',
            border:      `var(--border-width) solid var(--color-border)`,
            borderLeft:  isUser
              ? 'var(--border-width) solid var(--color-border)'
              : 'var(--border-width-thick) solid var(--color-border-strong)',
            padding:     'var(--space-3) var(--space-4)',
          }}
        >
          <p
            style={{
              margin:     0,
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--text-base)',
              lineHeight: 'var(--leading-normal)',
              color:      isUser
                ? 'var(--color-text-secondary)'
                : 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak:  'break-word',
            }}
          >
            {content}
            {isStreaming && <StreamCursor />}
          </p>
        </div>
      </div>
    </div>
  )
}
