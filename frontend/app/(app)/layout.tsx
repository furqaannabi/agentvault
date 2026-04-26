import { AppShell } from '@/components/layout/AppShell'
import { AuthGate } from '@/components/layout/AuthGate'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  )
}
