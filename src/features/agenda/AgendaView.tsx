import { useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, CalendarDays, CalendarPlus, Link2, Trash2 } from 'lucide-react'
import type { Tab } from '../../components/TabBar'
import type { AgendaItem } from '../../types/agenda'
import { useAgenda } from './useAgenda'

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** All-day events are dates, so they are grouped by the calendar date they carry, never shifted by the time zone. */
function dayKey(item: AgendaItem): string {
  return item.allDay ? item.startsAt.slice(0, 10) : localKey(new Date(item.startsAt))
}

function dayTitle(key: string): string {
  const today = new Date()
  if (key < localKey(today)) return 'Overdue'
  if (key === localKey(today)) return 'Today'
  if (key === localKey(new Date(today.getTime() + 24 * 60 * 60 * 1000))) return 'Tomorrow'
  const [y, m, d] = key.split('-').map(Number)
  return dayFormat.format(new Date(y, m - 1, d))
}

function timeText(item: AgendaItem): string {
  if (item.allDay) return 'All day'
  const start = timeFormat.format(new Date(item.startsAt))
  return item.endsAt ? `${start} – ${timeFormat.format(new Date(item.endsAt))}` : start
}

export function AgendaView({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { items, status, error, calendarLinked, calendarError, add, remove } = useAgenda()
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [adding, setAdding] = useState(false)

  const days = useMemo(() => {
    const groups = new Map<string, AgendaItem[]>()
    for (const item of items) groups.set(dayKey(item), [...(groups.get(dayKey(item)) ?? []), item])
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !when) return
    setAdding(true)
    const ok = await add({ title: title.trim(), startsAt: new Date(when).toISOString(), endsAt: null, notes: '' })
    setAdding(false)
    if (ok) {
      setTitle('')
      setWhen('')
    }
  }

  return (
    <section aria-labelledby="agenda-heading">
      <h1 id="agenda-heading" className="text-3xl font-extrabold tracking-tight">
        Your <span className="text-gradient">agenda</span>
      </h1>
      <p className="muted mt-1">The next two weeks. Ask the assistant about it, or tell it to add things.</p>

      {!calendarLinked && status === 'ready' && (
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="surface mt-5 flex w-full items-center gap-3 p-4 text-left hover:border-violet-400/60"
        >
          <Link2 className="size-5 shrink-0 text-violet-400" aria-hidden="true" />
          <span className="text-sm">
            <span className="font-semibold">Link your calendar</span>
            <span className="muted block">Add its private iCal address in your profile and your meetings show up here.</span>
          </span>
        </button>
      )}

      {calendarError && (
        <p role="alert" className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
          {calendarError}
        </p>
      )}

      <form onSubmit={(e) => void handleAdd(e)} className="surface mt-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="agenda-title" className="mb-1.5 block text-sm font-semibold">
            Add to agenda
          </label>
          <input
            id="agenda-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting with Mr Smith"
            maxLength={200}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="agenda-when" className="mb-1.5 block text-sm font-semibold">
            When
          </label>
          <input id="agenda-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field" />
        </div>
        <button type="submit" disabled={adding || !title.trim() || !when} className="btn btn-primary">
          <CalendarPlus className="size-4" aria-hidden="true" />
          Add
        </button>
      </form>

      {status === 'loading' && (
        <p role="status" className="muted mt-5">
          Loading your agenda…
        </p>
      )}

      {error && (
        <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <p className="muted mt-5 flex items-center gap-2">
          <CalendarDays className="size-5" aria-hidden="true" />
          Nothing on your agenda for the next two weeks.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-5">
        {days.map(([key, dayItems]) => (
          <div key={key}>
            <h2 className="muted mb-2 text-xs font-bold tracking-wide uppercase">{dayTitle(key)}</h2>
            <ul className="flex flex-col gap-2">
              {dayItems.map((item) => (
                <li key={item.id} className="surface flex items-center gap-3 p-3">
                  <span
                    className={`h-10 w-1 shrink-0 rounded-full ${
                      item.source === 'calendar' ? 'bg-cyan-400' : item.source === 'draft' ? 'bg-amber-400' : 'bg-linear-to-b from-indigo-500 to-fuchsia-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{item.title}</span>
                    <span className="muted block text-sm">
                      {timeText(item)}
                      {item.source === 'calendar' ? ' · from your calendar' : item.source === 'draft' ? ' · planned send' : ''}
                    </span>
                  </span>
                  {item.source === 'apex' && (
                    <button
                      type="button"
                      onClick={() => void remove(item.id)}
                      aria-label={`Delete ${item.title}`}
                      className="muted inline-flex size-9 items-center justify-center rounded-full hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
