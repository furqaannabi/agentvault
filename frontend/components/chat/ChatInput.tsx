'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Label, Mono } from '@/components/design-system/Typography'

interface ChatInputProps {
  onSend:      (message: string) => void
  disabled?:   boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  disabled    = false,
  placeholder = 'Message ProofTwin…',
}: ChatInputProps) {
  const [value, setValue]   = useState('')
  const textareaRef         = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter or Cmd+Enter → send
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSend()
      }
      // Plain Enter → send (Shift+Enter inserts newline)
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div
      style={{
        borderTop:       'var(--border-width) solid var(--color-border)',
        backgroundColor: 'var(--color-bg-surface)',
        padding:         'var(--space-4)',
      }}
    >
      {/* Textarea row */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        aria-label="Message input"
        style={{
          display:         'block',
          width:           '100%',
          resize:          'none',
          background:      'transparent',
          border:          'none',
          outline:         'none',
          fontFamily:      'var(--font-body)',
          fontSize:        'var(--text-base)',
          lineHeight:      'var(--leading-normal)',
          color:           disabled
            ? 'var(--color-text-muted)'
            : 'var(--color-text-primary)',
          caretColor:      'var(--color-text-primary)',
          marginBottom:    'var(--space-3)',
          overflowY:       'hidden',
          minHeight:       28,
        }}
      />

      {/* Bottom row: hint + send */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Keyboard hint */}
        <Mono size="xs" color="muted" as="span">
          {disabled ? 'Generating…' : '↵ send · shift+↵ newline'}
        </Mono>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             'var(--space-2)',
            padding:         'var(--space-2) var(--space-4)',
            background:      canSend ? 'var(--color-text-primary)' : 'transparent',
            border:          `var(--border-width) solid ${
              canSend ? 'var(--color-text-primary)' : 'var(--color-border-strong)'
            }`,
            color:           canSend
              ? 'var(--color-bg-base)'
              : 'var(--color-text-muted)',
            cursor:          canSend ? 'pointer' : 'default',
            transition:      `background var(--duration-fast) var(--ease-out),
                              border-color var(--duration-fast) var(--ease-out),
                              color var(--duration-fast) var(--ease-out)`,
          }}
        >
          <Label style={{
            fontSize: 'var(--text-xs)',
            color:    'inherit',
          }}>
            SEND
          </Label>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   'var(--text-xs)',
            color:      'inherit',
            lineHeight: 1,
          }}>
            →
          </span>
        </button>
      </div>
    </div>
  )
}
