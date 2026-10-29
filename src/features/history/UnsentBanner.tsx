import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { listDrafts } from '../../lib/drafts-api'

const SENDABLE = ['EMAIL', 'QUOTE', 'WHATSAPP', 'SMS']
/** A draft made a moment ago is still being worked on; only older ones count as forgotten. */
const GRACE_MS = 10 * 60_000
/** Older than this is probably a test or a draft given up on, so it does not nag. */
const MAX_AGE_MS = 7 * 24 * 60 * 60_000
const DISMISS_KEY = 'apex-unsent-dismissed'

function dismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === new Date().toDateString()
  } catch {
    return false
  }
}

interface UnsentBannerProps {
  onReview: () => void
}

/** Reminds the person, when they open Apex, of messages they wrote but never marked as sent. */
export function UnsentBanner({ onReview }: UnsentBannerProps) {
  const [count, setCount] = useState(0)
  const [hidden, setHidden] = useState(dismissedToday)

  useEffect(() => {
    if (hidden) return
    let cancelled = false
    listDrafts()
      .then((drafts) => {
        const now = Date.now()
        const waiting = drafts.filter((d) => {
          const age = now - new Date(d.createdAt).getTime()
          return d.sentAt === null && SENDABLE.includes(d.category) && age > GRACE_MS && age < MAX_AGE_MS
        })
        if (!cancelled) setCount(waiting.length)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [hidden])

  if (hidden || count === 0) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toDateString())
    } catch {
      // the reminder simply comes back next time
    }
    setHidden(true)
  }

  return (
    <div role="status" className="surface mb-5 flex items-center gap-3 p-4 text-left">
      <BellRing className="size-5 shrink-0 text-amber-500" aria-hidden="true" />
      <p className="flex-1 text-sm">You haven&apos;t sent {count === 1 ? '1 message' : `${count} messages`} yet.</p>
      <button type="button" onClick={onReview} className="btn btn-channel">
        Review
      </button>
      <button type="button" onClick={dismiss} aria-label="Hide until tomorrow" className="btn btn-ghost">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
