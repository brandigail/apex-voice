import { useCallback, useEffect, useState } from 'react'
import { ApiRequestError } from '../../lib/api'
import { deleteDraft, listDrafts, updateDraftStatus } from '../../lib/drafts-api'
import type { DraftStatusUpdate } from '../../types/draft'
import type { Draft } from '../../types/draft'

export type DraftsStatus = 'loading' | 'ready' | 'error'

export interface UseDrafts {
  drafts: Draft[]
  status: DraftsStatus
  error: string | null
  reload: () => void
  /** Removes the draft from the list straight away and puts it back if the server refuses. Returns whether it worked. */
  remove: (id: string) => Promise<boolean>
  /** Marks the draft as sent and/or plans when to send it, and shows the change straight away. */
  updateStatus: (id: string, update: DraftStatusUpdate) => Promise<void>
}

function messageFrom(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'
}

export function useDrafts(): UseDrafts {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [status, setStatus] = useState<DraftsStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    listDrafts()
      .then((loaded) => {
        if (cancelled) return
        setDrafts(loaded)
        setError(null)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(messageFrom(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const reload = useCallback(() => {
    setStatus('loading')
    setReloadKey((key) => key + 1)
  }, [])

  const remove = useCallback(
    async (id: string) => {
      const previous = drafts
      setDrafts(previous.filter((draft) => draft.id !== id))
      try {
        await deleteDraft(id)
        return true
      } catch (err) {
        setDrafts(previous)
        setError(messageFrom(err))
        return false
      }
    },
    [drafts],
  )

  const updateStatus = useCallback(async (id: string, update: DraftStatusUpdate) => {
    try {
      const updated = await updateDraftStatus(id, update)
      setDrafts((current) => current.map((draft) => (draft.id === id ? updated : draft)))
      setError(null)
    } catch (err) {
      setError(messageFrom(err))
    }
  }, [])

  return { drafts, status, error, reload, remove, updateStatus }
}
