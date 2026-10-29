import { useEffect } from 'react'
import { describeDevice, reportActivity } from './activity-api'

/** While someone is signed in, reports that they opened the app and any error the page runs into. */
export function useActivityReporting(signedIn: boolean, tab: string): void {
  useEffect(() => {
    if (!signedIn) return
    reportActivity('session_start', describeDevice())
    const onError = (event: ErrorEvent) => reportActivity('client_error', { message: event.message, where: event.filename })
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason
      reportActivity('client_error', { message: reason instanceof Error ? reason.message : String(reason) })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [signedIn])

  useEffect(() => {
    if (signedIn) reportActivity('screen', { tab })
  }, [signedIn, tab])
}
