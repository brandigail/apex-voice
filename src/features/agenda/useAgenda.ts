import { useCallback, useEffect, useState } from 'react'
import { addAgendaItem, deleteAgendaItem, listAgenda } from '../../lib/agenda-api'
import { ApiRequestError } from '../../lib/api'
import type { AgendaItem, NewAgendaItem } from '../../types/agenda'

const DAYS_AHEAD = 14

export type AgendaStatus = 'loading' | 'ready' | 'error'

function messageFrom(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export interface UseAgenda {
  items: AgendaItem[]
  status: AgendaStatus
  error: string | null
  calendarLinked: boolean
  calendarError: string | null
  reload: () => void
  add: (item: NewAgendaItem) => Promise<boolean>
  remove: (id: string) => Promise<void>
}

export function useAgenda(): UseAgenda {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [status, setStatus] = useState<AgendaStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [calendarLinked, setCalendarLinked] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const from = startOfToday()
    const to = new Date(from.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000)
    listAgenda(from, to)
      .then((agenda) => {
        if (cancelled) return
        setItems(agenda.items)
        setCalendarLinked(agenda.calendarLinked)
        setCalendarError(agenda.calendarError)
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

  const add = useCallback(async (item: NewAgendaItem) => {
    try {
      await addAgendaItem(item)
      setError(null)
      setReloadKey((key) => key + 1)
      return true
    } catch (err) {
      setError(messageFrom(err))
      return false
    }
  }, [])

  const remove = useCallback(
    async (id: string) => {
      const previous = items
      setItems(previous.filter((item) => item.id !== id))
      try {
        await deleteAgendaItem(id)
      } catch (err) {
        setItems(previous)
        setError(messageFrom(err))
      }
    },
    [items],
  )

  return { items, status, error, calendarLinked, calendarError, reload, add, remove }
}
