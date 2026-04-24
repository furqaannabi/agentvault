'use client'

import React, { useState, createContext, useContext, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Label, Mono } from '@/components/design-system/Typography'
import { useChatStore } from '@/lib/store/chatStore'

// ── Drawer context ─────────────────────────────────────────────────────────────

interface DrawerContextValue {
  isOpen:      boolean
  openDrawer:  (content: React.ReactNode) => void
  closeDrawer: () => void
}

export const DrawerContext = createContext<DrawerContextValue>({
  isOpen:      false,
  openDrawer:  () => {},
  closeDrawer: () => {},
})

export function useDrawer() {
  return useContext(DrawerContext)
}

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'DECISION LOG',     href: '/',       phase: 1, icon: <IconLog />    },
  { label: 'SPECIALIST SWARM', href: '/swarm',  phase: 2, icon: <IconSwarm />  },
  { label: 'POLICY ENGINE',    href: '/policy', phase: 2, icon: <IconPolicy /> },
  { label: 'PROOF EXPLORER',   href: '/proof',  phase: 1, icon: <IconProof />  },
] as const

const BOTTOM_ITEMS = [
  { label: 'SYSTEM STATUS',  href: '/status' },
  { label: 'DOCUMENTATION',  href: '/docs'   },
]

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconLog() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <rect x="1" y="2"   width="11" height="1.5" fill="currentColor" />
      <rect x="1" y="5.5" width="7"  height="1.5" fill="currentColor" />
      <rect x="1" y="9"   width="9"  height="1.5" fill="currentColor" />
    </svg>
  )
}

function IconSwarm() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <circle cx="6.5" cy="2"  r="1.5" fill="currentColor" />
      <circle cx="2"   cy="11" r="1.5" fill="currentColor" />
      <circle cx="11"  cy="11" r="1.5" fill="currentColor" />
      <line x1="6.5" y1="3.5" x2="2"  y2="9.5"  stroke="currentColor" strokeWidth="1" />
      <line x1="6.5" y1="3.5" x2="11" y2="9.5"  stroke="currentColor" strokeWidth="1" />
      <line x1="2"   y1="11"  x2="11" y2="11"   stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function IconPolicy() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="3.5" y="3.5" width="2.5" height="2.5" fill="currentColor" />
      <line x1="3.5" y1="8.5" x2="9.5" y2="8.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function IconProof() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 1L1.5 3.5V7C1.5 9.5 3.7 11.8 6.5 12.5C9.3 11.8 11.5 9.5 11.5 7V3.5L6.5 1Z"
        stroke="currentColor" strokeWidth="1.5" fill="none" />
      <polyline points="4,6.5 6,8.5 9.5,4.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" fill="none" />
    </svg>
  )
}

// ── Relative time ──────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const d = Date.now() - ts
  const m = Math.floor(d / 60_000)
  const h = Math.floor(d / 3_600_000)
  if (m  < 1)  return 'now'
  if (m  < 60) return `${m}m`
  if (h  < 24) return `${h}h`
  return `${Math.floor(d / 86_400_000)}d`
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarInnerProps {
  onNewChat:       () => void
  onSelectSession: (id: string) => void
}

function SidebarInner({ onNewChat, onSelectSession }: SidebarInnerProps) {
  const pathname      = usePathname()
  const sessions      = useChatStore((s) => s.sessions)
  const activeId      = useChatStore((s) => s.activeSessionId)
  const isStreaming   = useChatStore((s) => s.isStreaming)

  return (
    <aside
      style={{
        width:           'var(--sidebar-width)',
        minWidth:        'var(--sidebar-width)',
        height:          '100vh',
        position:        'sticky',
        top:             0,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--color-bg-surface)',
        borderRight:     'var(--border-width) solid var(--color-border)',
        overflowY:       'auto',
        flexShrink:      0,
      }}
    >
      {/* Logo */}
      <div style={{
        padding:      'var(--space-5) var(--space-4) var(--space-4)',
        borderBottom: 'var(--border-width) solid var(--color-border)',
        flexShrink:   0,
      }}>
        <div style={{
          fontFamily:    'var(--font-display)',
          fontWeight:    'var(--weight-semibold)',
          fontSize:      'var(--text-base)',
          color:         'var(--color-text-primary)',
          letterSpacing: 'var(--tracking-tight)',
        }}>
          AgentVault
        </div>
        <div style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      'var(--text-xs)',
          color:         'var(--color-text-muted)',
          letterSpacing: 'var(--tracking-wide)',
          marginTop:     'var(--space-1)',
          textTransform: 'uppercase',
        }}>
          V.2.4.0-ACTIVE
        </div>
      </div>

      {/* Primary nav */}
      <nav style={{ padding: 'var(--space-2) 0', flexShrink: 0 }} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const isPhase2 = item.phase === 2

          return (
            <Link
              key={item.href}
              href={isPhase2 ? '#' : item.href}
              aria-disabled={isPhase2}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            'var(--space-3)',
                padding:        'var(--space-2) var(--space-4)',
                color:          isPhase2
                  ? 'var(--color-text-muted)'
                  : isActive
                    ? '#ffffff'
                    : 'var(--color-text-primary)',
                textDecoration: 'none',
                backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                borderLeft:     isActive
                  ? '2px solid #ffffff'
                  : '2px solid transparent',
                transition:     `background-color var(--duration-fast) var(--ease-out),
                                 color var(--duration-fast) var(--ease-out)`,
                cursor:         isPhase2 ? 'default' : 'pointer',
                pointerEvents:  isPhase2 ? 'none' : 'auto',
                opacity:        isPhase2 ? 0.35 : 1,
              }}
            >
              <span style={{ flexShrink: 0, color: 'inherit' }}>{item.icon}</span>
              <Label
                color={isPhase2 ? 'muted' : isActive ? 'primary' : 'secondary'}
                style={{ fontSize: 'var(--text-xs)' }}
              >
                {item.label}
              </Label>
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div style={{ borderTop: 'var(--border-width) solid var(--color-border)', flexShrink: 0 }} />

      {/* New chat */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', flexShrink: 0 }}>
        <button
          onClick={onNewChat}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            'var(--space-2)',
            width:          '100%',
            padding:        'var(--space-2) var(--space-3)',
            background:     'transparent',
            border:         'var(--border-width) solid var(--color-border-strong)',
            cursor:         'pointer',
            color:          'var(--color-text-secondary)',
            transition:     `border-color var(--duration-fast) var(--ease-out),
                             color var(--duration-fast) var(--ease-out)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-text-secondary)'
            e.currentTarget.style.color       = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-strong)'
            e.currentTarget.style.color       = 'var(--color-text-secondary)'
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>+</span>
          <Label style={{ fontSize: 'var(--text-xs)' }}>New Chat</Label>
        </button>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>
              No conversations
            </Label>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeId
            return (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                style={{
                  display:         'block',
                  width:           '100%',
                  textAlign:       'left',
                  background:      isActive ? 'var(--color-bg-overlay)' : 'transparent',
                  border:          'none',
                  borderLeft:      isActive
                    ? '2px solid var(--color-text-primary)'
                    : '2px solid transparent',
                  borderBottom:    'var(--border-width) solid var(--color-border-subtle)',
                  padding:         'var(--space-3) var(--space-4)',
                  cursor:          'pointer',
                }}
              >
                <div style={{
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--text-sm)',
                  color:        isActive
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  marginBottom: 'var(--space-1)',
                }}>
                  {session.title}
                </div>
                <Mono size="xs" color="muted" as="span">
                  {relativeTime(session.lastMessageAt)}
                </Mono>
              </button>
            )
          })
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{
        padding:   'var(--space-2) 0',
        borderTop: 'var(--border-width) solid var(--color-border)',
        flexShrink: 0,
      }} aria-label="Secondary">
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display:        'flex',
              padding:        'var(--space-2) var(--space-4)',
              textDecoration: 'none',
            }}
          >
            <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>
              {item.label}
            </Label>
          </Link>
        ))}
      </nav>
    </aside>
  )
}

// ── AppShell ───────────────────────────────────────────────────────────────────

interface AppShellProps {
  children:        React.ReactNode
  onNewChat?:      () => void
  onSelectSession?: (id: string) => void
}

export function AppShell({
  children,
  onNewChat       = () => {},
  onSelectSession = () => {},
}: AppShellProps) {
  const [isOpen, setIsOpen]               = useState(false)
  const [drawerContent, setDrawerContent] = useState<React.ReactNode>(null)

  const openDrawer  = useCallback((content: React.ReactNode) => {
    setDrawerContent(content)
    setIsOpen(true)
  }, [])

  const closeDrawer = useCallback(() => setIsOpen(false), [])

  return (
    <DrawerContext.Provider value={{ isOpen, openDrawer, closeDrawer }}>
      <div style={{
        display:         'flex',
        minHeight:       '100vh',
        backgroundColor: 'var(--color-bg-base)',
      }}>
        <SidebarInner
          onNewChat={onNewChat}
          onSelectSession={onSelectSession}
        />

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100vh' }}>
          {children}
        </main>

        {/* Drawer */}
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={closeDrawer}
                style={{
                  position:        'fixed',
                  inset:           0,
                  backgroundColor: 'rgba(8, 12, 16, 0.7)',
                  zIndex:          'var(--z-overlay)',
                }}
              />
              <motion.aside
                key="drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position:        'fixed',
                  top:             0,
                  right:           0,
                  width:           'var(--drawer-width)',
                  height:          '100vh',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderLeft:      'var(--border-width) solid var(--color-border)',
                  zIndex:          'var(--z-drawer)',
                  display:         'flex',
                  flexDirection:   'column',
                  overflowY:       'auto',
                }}
              >
                <div style={{
                  display:         'flex',
                  justifyContent:  'flex-end',
                  padding:         'var(--space-4)',
                  borderBottom:    'var(--border-width) solid var(--color-border)',
                  flexShrink:      0,
                }}>
                  <button
                    onClick={closeDrawer}
                    aria-label="Close"
                    style={{
                      background:  'none',
                      border:      'var(--border-width) solid var(--color-border)',
                      padding:     'var(--space-2) var(--space-3)',
                      cursor:      'pointer',
                      color:       'var(--color-text-muted)',
                    }}
                  >
                    <Label color="muted" style={{ fontSize: 'var(--text-xs)' }}>
                      ESC
                    </Label>
                  </button>
                </div>
                <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}>
                  {drawerContent}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </DrawerContext.Provider>
  )
}
