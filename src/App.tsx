import { useState } from 'react'
import { AppShell } from './components/AppShell'
import type { Tab } from './components/TabBar'
import { HistoryView } from './features/history/HistoryView'
import { RecordView } from './features/record/RecordView'

export default function App() {
  const [tab, setTab] = useState<Tab>('record')

  return (
    <AppShell activeTab={tab} onTabChange={setTab}>
      {tab === 'record' ? <RecordView /> : <HistoryView />}
    </AppShell>
  )
}
