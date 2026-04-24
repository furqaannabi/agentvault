'use client'

import React, { useState, createContext, useContext, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Label } from '@/components/design-system/Typography'

// ── Drawer context ─────────────────────────────────────────────────────────────
// Any child component can call openDrawer(content) to slide in the right panel.

interface DrawerContextValue {
  isOpen:        boolean
  openDrawer:    (content: React.ReactNode) => void
  closeDrawer:   () => void
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

interface NavItem {
  label: string
  href:  string
  icon:  React.ReactNode
  phase: 1 | 2
}

const NAV_ITEMS: NavItem[] = [
  { label: 'DECISION LOG',     href: '/',       icon: <IconLog />,    phase: 1 },
  { label: 'SPECIALIST SWARM', href: '/swarm',  icon: <IconSwarm />,  phase: 2 },
  { label: 'POLICY ENGINE',    href: '/policy', icon: <IconPolicy />, phase: 2 },
  { label: 'PROOF EXPLORER',   href: '/proof',  icon: <IconProof />,  phase: 1 },
]

const BOTTOM_ITEMS = [
  { label: 'SYSTEM STATUS',  href: '/status' },
  { label: 'DOCUMENTATION',  href: '/docs'   },
]

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconLog() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="2" width="12" height="1.5" fill="currentColor" />
      <rect x="1" y="5.5" width="8" height="1.5" fill="currentColor" />
      <rect x="1" y="9" width="10" height="1.5" fill="currentColor" />
    </svg>
  )
}

function IconSwarm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7"  cy="2.5" r="1.5" fill="currentColor" />
      <circle cx="2"  cy="11" r="1.5"  fill="currentColor" />
      <circle cx="12" cy="11" r="1.5"  fill="currentColor" />
      <line x1="7" y1="4" x2="2" y2="9.5"   stroke="currentColor" strokeWidth="1" />
      <line x1="7" y1="4" x2="12" y2="9.5"  stroke="currentColor" strokeWidth="1" />
      <line x1="2" y1="11" x2="12" y2="11"  stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function IconPolicy() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="10" height="10" rx="0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="4" y="4" width="3"  height="3"  fill="currentColor" />
      <rect x="8" y="7" width="2"  height="2"  fill="currentColor" />
      <line x1="4" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function IconProof() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1L2 3.5V7C2 9.8 4.2 12.3 7 13C9.8 12.3 12 9.8 12 7V3.5L7 1Z"
        stroke="currentColor" strokeWidth="1.5" fill="none" />
      <polyline points="4.5,7 6.5,9 9.5,5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" fill="none" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="11" y1="1" x2="1"  y2="11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar() {
  const pathname = usePathname()

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
      <div
        style={{
          padding:      'var(--space-6) var(--space-4) var(--space-4)',
          borderBottom: 'var(--border-width) solid var(--color-border)',
        }}
      >
        <div
          style={{
            fontFamily:    'var(--font-display)',
            fontWeight:    'var(--weight-bold)',
            fontSize:      'var(--text-md)',
            color:         'var(--color-text-primary)',
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          AgentVault
        </div>
        <div
          style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      'var(--text-xs)',
            color:         'var(--color-text-muted)',
            letterSpacing: 'var(--tracking-wide)',
            marginTop:     'var(--space-1)',
            textTransform: 'uppercase',
          }}
        >
          V.2.4.0-ACTIVE
        </div>
      </div>

      {/* Primary nav */}
      <nav style={{ flex: 1, padding: 'var(--space-3) 0' }} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive  = pathname === item.href || pathname.startsWith(item.href + '/')
          const isPhase2  = item.phase === 2
          const textColor = isPhase2
            ? 'var(--color-text-muted)'
            : isActive
              ? 'var(--color-accent-teal)'
              : 'var(--color-text-secondary)'

          return (
            <Link
              key={item.href}
              href={isPhase2 ? '#' : item.href}
              aria-disabled={isPhase2}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             'var(--space-3)',
                padding:         'var(--space-3) var(--space-4)',
                color:           textColor,
                textDecoration:  'none',
                backgroundColor: isActive
                  ? 'var(--color-bg-overlay)'
                  : 'transparent',
                borderLeft: isActive
                  ? '2px solid var(--color-accent-teal)'
                  : '2px solid transparent',
                transition:      `background-color var(--duration-fast) var(--ease-out),
                                  color var(--duration-fast) var(--ease-out)`,
                cursor:          isPhase2 ? 'default' : 'pointer',
                pointerEvents:   isPhase2 ? 'none' : 'auto',
              }}
            >
              <span style={{ flexShrink: 0, opacity: isPhase2 ? 0.4 : 1 }}>
                {item.icon}
              </span>
              <Label
                color={isPhase2 ? 'muted' : isActive ? 'teal' : 'secondary'}
                style={{ fontSize: 'var(--text-xs)', opacity: isPhase2 ? 0.5 : 1 }}
              >
                {item.label}
              </Label>
            </Link>
          )
        })}
      </nav>

      {/* Bottom nav */}
      <nav
        style={{
          padding:   'var(--space-3) 0',
          borderTop: 'var(--border-width) solid var(--color-border)',
        }}
        aria-label="Secondary"
      >
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display:        'flex',
              alignItems:     'center',
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
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isOpen, setIsOpen]               = useState(false)
  const [drawerContent, setDrawerContent] = useState<React.ReactNode>(null)

  const openDrawer = useCallback((content: React.ReactNode) => {
    setDrawerContent(content)
    setIsOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <DrawerContext.Provider value={{ isOpen, openDrawer, closeDrawer }}>
      <div
        style={{
          display:         'flex',
          minHeight:       '100vh',
          backgroundColor: 'var(--color-bg-base)',
          position:        'relative',
          backgroundImage: 'var(--scanline)',
        }}
      >
        <Sidebar />

        {/* Main content */}
        <main
          style={{
            flex:       1,
            minWidth:   0,
            overflowY:  'auto',
            height:     '100vh',
            position:   'relative',
          }}
        >
          {children}
        </main>

        {/* Right drawer */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={closeDrawer}
                style={{
                  position:        'fixed',
                  inset:           0,
                  backgroundColor: 'rgba(8, 12, 16, 0.6)',
                  zIndex:          'var(--z-overlay)',
                }}
              />

              {/* Drawer panel */}
              <motion.aside
                key="drawer-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                {/* Drawer header */}
                <div
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'flex-end',
                    padding:         'var(--space-4)',
                    borderBottom:    'var(--border-width) solid var(--color-border)',
                    flexShrink:      0,
                  }}
                >
                  <button
                    onClick={closeDrawer}
                    aria-label="Close drawer"
                    style={{
                      background:  'none',
                      border:      'var(--border-width) solid var(--color-border)',
                      padding:     'var(--space-2)',
                      cursor:      'pointer',
                      color:       'var(--color-text-muted)',
                      display:     'flex',
                      alignItems:  'center',
                      transition:  `color var(--duration-fast) var(--ease-out),
                                    border-color var(--duration-fast) var(--ease-out)`,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget
                      el.style.color = 'var(--color-text-primary)'
                      el.style.borderColor = 'var(--color-border-strong)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget
                      el.style.color = 'var(--color-text-muted)'
                      el.style.borderColor = 'var(--color-border)'
                    }}
                  >
                    <IconClose />
                  </button>
                </div>

                {/* Drawer content slot */}
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
