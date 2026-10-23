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
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header signedIn={signedIn} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-28">{children}</main>
      {signedIn && <TabBar active={activeTab} onChange={onTabChange} />}
    </div>
  )
}
