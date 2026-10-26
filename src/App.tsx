import { useState } from 'react'
import { AppShell } from './components/AppShell'
import type { Tab } from './components/TabBar'
import { AuthScreen } from './features/auth/AuthScreen'
import { AgendaView } from './features/agenda/AgendaView'
import { AssistantView } from './features/assistant/AssistantView'
import { HistoryView } from './features/history/HistoryView'
import { ProfileView } from './features/profile/ProfileView'
import { RecordView } from './features/record/RecordView'
import { authClient } from './lib/auth-client'
import { useFeatures } from './lib/useFeatures'
import { GuidedTour } from './features/tour/GuidedTour'
import { highlight, hasSeenTour, markTourSeen } from './features/tour/highlight'
import { TOUR_STEPS, type TourStep } from './features/tour/steps'

export default function App() {
  // Coming back from PayFast lands on the profile, where the subscription is shown.
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).has('payment') ? 'profile' : 'record'))
  const { data: session, isPending } = authClient.useSession()
  const features = useFeatures(Boolean(session))

  // The tour opens by itself the first time someone signs in on this device; the "?" button opens it again.
  const userId = session?.user.id
  const [tourRequested, setTourRequested] = useState<boolean | undefined>(undefined)
  const [tourStep, setTourStep] = useState(0)
  /** Where to carry on from after a "Show me" visit to a real screen; null when no tour is waiting. */
  const [resumeAt, setResumeAt] = useState<number | null>(null)
  const tourOpen = userId !== undefined && (tourRequested ?? !hasSeenTour(userId))

  const finishTour = () => {
    if (userId) markTourSeen(userId)
    setTourRequested(false)
    setTourStep(0)
    setResumeAt(null)
  }
  const showStep = (step: TourStep, index: number) => {
    if (!step.show || !userId) return
    markTourSeen(userId)
    setTourRequested(false)
    setTab(step.show.tab)
    setResumeAt(index + 1 < TOUR_STEPS.length ? index + 1 : null)
    window.setTimeout(() => highlight(step.show?.target ?? ''), 600)
  }
  const openTour = () => {
    setTourStep(0)
    setResumeAt(null)
    setTourRequested(true)
  }
  const resumeTour = () => {
    setTourStep(resumeAt ?? 0)
    setResumeAt(null)
    setTourRequested(true)
  }

  return (
    <AppShell activeTab={tab} onTabChange={setTab} signedIn={Boolean(session)} onHelp={openTour}>
      {isPending ? (
        <p role="status" className="text-center text-slate-500 dark:text-slate-400">
          Loading…
        </p>
      ) : !session ? (
        <AuthScreen />
      ) : tab === 'record' ? (
        <RecordView />
      ) : tab === 'assistant' ? (
        <AssistantView firstName={session.user.name.trim().split(/\s+/)[0] ?? ''} onNavigate={setTab} />
      ) : tab === 'agenda' ? (
        <AgendaView onNavigate={setTab} />
      ) : tab === 'history' ? (
        <HistoryView />
      ) : (
        <ProfileView user={session.user} showSubscriptions={features.subscriptions} />
      )}
      {session && (
        <GuidedTour open={tourOpen} step={tourStep} onStep={setTourStep} onFinish={finishTour} onShow={showStep} />
      )}
      {session && resumeAt !== null && !tourOpen && (
        <button
          type="button"
          onClick={resumeTour}
          className="btn btn-primary fixed bottom-24 left-1/2 z-30 -translate-x-1/2 shadow-2xl"
        >
          Back to the tour
        </button>
      )}
    </AppShell>
  )
}
