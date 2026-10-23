import { useState } from 'react'
import { AppShell } from './components/AppShell'
import type { Tab } from './components/TabBar'
import { PasscodeGate } from './features/auth/PasscodeGate'
import { HistoryView } from './features/history/HistoryView'
import { RecordView } from './features/record/RecordView'
import { usePasscode } from './providers/usePasscode'

export default function App() {
  const [tab, setTab] = useState<Tab>('record')
  const { passcode } = usePasscode()

  return (
    <AppShell activeTab={tab} onTabChange={setTab}>
      {!passcode ? <PasscodeGate /> : tab === 'record' ? <RecordView /> : <HistoryView />}
    </AppShell>
  )
}
