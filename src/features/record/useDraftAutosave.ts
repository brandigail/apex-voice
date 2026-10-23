import { useEffect, useRef, useState } from 'react'
import { saveDraft } from '../../lib/drafts-api'
import type { VoiceNoteResult } from './useVoiceNote'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** How long to wait after the last edit before saving, so typing doesn't send a request per keystroke. */
const SAVE_DELAY_MS = 800

interface TrackedStatus {
  id: string
  status: SaveStatus
}

/** Saves the draft to the user's history shortly after it appears and again after each edit. */
export function useDraftAutosave(result: VoiceNoteResult | null): SaveStatus {
  const [tracked, setTracked] = useState<TrackedStatus | null>(null)
  /** Saves run one after another so an older request can never land after a newer one. */
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!result || !result.draft.body.trim()) return

    const timer = window.setTimeout(() => {
      const { id } = result
      queueRef.current = queueRef.current.then(async () => {
        setTracked({ id, status: 'saving' })
        try {
          const now = new Date().toISOString()
          await saveDraft({ ...result.draft, id, transcript: result.transcript, createdAt: result.createdAt, updatedAt: now })
          setTracked({ id, status: 'saved' })
        } catch {
          setTracked({ id, status: 'error' })
        }
      })
    }, SAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [result])

  // Status belongs to one draft; a new draft starts fresh.
  return result && tracked?.id === result.id ? tracked.status : 'idle'
}
