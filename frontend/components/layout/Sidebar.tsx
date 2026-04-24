'use client'

import React from 'react'
import { Label, Mono } from '@/components/design-system/Typography'
import type { ConversationSession } from '@/lib/types'

interface SidebarProps {
  sessions:        ConversationSession[]
  activeSessionId: string | null
  isLoading:       boolean
  onNewChat:       () => void
  onSelectSession: (sessionId: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ── Skeleton row ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      style={{
        padding:      'var(--space-3) var(--space-4)',
        borderBottom: 'var(--border-width) solid var(--color-border-subtle)',
      }}
    >
      <div
        style={{
          height:          10,
          width:           '70%',
          backgroundColor: 'var(--color-bg-elevated)',
          marginBottom:    'var(--space-2)',
        }}
      />
      <div
        style={{
          height:          8,
          width:           '35%',
          backgroundColor: 'var(--color-bg-elevated)',
        }}
      />
    </div>
  )
}

// ── Session row ────────────────────────────────────────────────────────────────

interface SessionRowProps {
  session:  ConversationSession
  isActive: boolean
  onClick:  () => void
}

function SessionRow({ session, isActive, onClick }: SessionRowProps) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={isActive ? 'true' : undefined}
      style={{
        display:         'block',
        width:           '100%',
        textAlign:       'left',
        background:      isActive || hovered
          ? 'var(--color-bg-overlay)'
          : 'transparent',
        border:          'none',
        borderLeft:      isActive
          ? '2px solid var(--color-accent-teal)'
          : '2px solid transparent',
        borderBottom:    'var(--border-width) solid var(--color-border-subtle)',
        padding:         'var(--space-3) var(--space-4)',
        cursor:          'pointer',
        transition:      `background var(--duration-fast) var(--ease-out)`,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily:    'var(--font-body)',
          fontSize:      'var(--text-base)',
          color:         isActive
            ? 'var(--color-text-primary)'
            : 'var(--color-text-secondary)',
          marginBottom:  'var(--space-1)',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
          fontWeight:    isActive
            ? 'var(--weight-medium)'
            : 'var(--weight-regular)',
        }}
      >
        {session.title}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <Mono size="xs" color="muted" as="span">
          {relativeTime(session.lastMessageAt)}
        </Mono>
        <Mono size="xs" color="muted" as="span">
          {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
        </Mono>
      </div>
    </button>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar({
  sessions,
  activeSessionId,
  isLoading,
  onNewChat,
  onSelectSession,
}: SidebarProps) {
  return (
    <aside
      style={{
        width:           240,
        minWidth:        240,
        height:          '100%',
        display:         'flex',
        flexDirection:   'column',
        borderRight:     'var(--border-width) solid var(--color-border)',
        backgroundColor: 'var(--color-bg-surface)',
      }}
    >
      {/* New chat button */}
      <div
        style={{
          padding:      'var(--space-4)',
          borderBottom: 'var(--border-width) solid var(--color-border)',
          flexShrink:   0,
        }}
      >
        <button
          onClick={onNewChat}
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             'var(--space-2)',
            width:           '100%',
            padding:         'var(--space-3) var(--space-4)',
            background:      'transparent',
            border:          'var(--border-width) solid var(--color-border-strong)',
            cursor:          'pointer',
            color:           'var(--color-text-secondary)',
            transition:      `border-color var(--duration-fast) var(--ease-out),
                              color var(--duration-fast) var(--ease-out)`,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--color-accent-teal)'
            el.style.color       = 'var(--color-accent-teal)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--color-border-strong)'
            el.style.color       = 'var(--color-text-secondary)'
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <Label color="secondary">New Chat</Label>
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Loading */}
        {isLoading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {/* Empty */}
        {!isLoading && sessions.length === 0 && (
          <div
            style={{
              padding:   'var(--space-8) var(--space-4)',
              textAlign: 'center',
            }}
          >
            <Label color="muted">No conversations yet</Label>
          </div>
        )}

        {/* Populated */}
        {!isLoading && sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            onClick={() => onSelectSession(session.id)}
          />
        ))}
      </div>
    </aside>
  )
}
