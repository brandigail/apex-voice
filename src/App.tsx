import { useState } from 'react'
import { AppShell } from './components/AppShell'
import type { Tab } from './components/TabBar'
import { AuthScreen } from './features/auth/AuthScreen'
import { HistoryView } from './features/history/HistoryView'
import { RecordView } from './features/record/RecordView'
import { authClient } from './lib/auth-client'

export default function App() {
  const [tab, setTab] = useState<Tab>('record')
  const { data: session, isPending } = authClient.useSession()

  return (
    <AppShell activeTab={tab} onTabChange={setTab} signedIn={Boolean(session)}>
      {isPending ? (
        <p role="status" className="text-center text-slate-500 dark:text-slate-400">
          Loading…
        </p>
      ) : !session ? (
        <AuthScreen />
      ) : tab === 'record' ? (
        <RecordView />
      ) : (
        <HistoryView />
      )}
    </AppShell>
  )
}
