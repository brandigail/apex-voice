import type { ReactNode } from 'react'
import { Header } from './Header'
import { TabBar, type Tab } from './TabBar'

interface AppShellProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  /** The tab bar and account menu only make sense once signed in. */
  signedIn: boolean
  children: ReactNode
}

export function AppShell({ activeTab, onTabChange, signedIn, children }: AppShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="aurora" aria-hidden="true" />
      <Header signedIn={signedIn} />
      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-32">{children}</main>
      {signedIn && <TabBar active={activeTab} onChange={onTabChange} />}
    </div>
  )
}
