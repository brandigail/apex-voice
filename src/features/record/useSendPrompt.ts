import { useCallback, useEffect, useState } from 'react'

/**
 * Apex cannot see whether a message was really sent from WhatsApp or a mail app. So when someone taps a send button and
 * then comes back to Apex, it asks them. `begin` is called on the tap; `asking` turns true when they return.
 */
export function useSendPrompt() {
  const [waiting, setWaiting] = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!waiting) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setWaiting(false)
      setAsking(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [waiting])

  const begin = useCallback(() => setWaiting(true), [])
  const close = useCallback(() => {
    setWaiting(false)
    setAsking(false)
  }, [])
  return { asking, begin, close }
}
