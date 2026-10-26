import ical, { type VEvent } from 'node-ical'
import type { AgendaItem } from '../../../src/types/agenda.ts'

const FETCH_TIMEOUT_MS = 5_000
const MAX_BYTES = 4 * 1024 * 1024
const MAX_REDIRECTS = 3
const CACHE_MS = 5 * 60 * 1000
/** Safety net for a recurring event with no end: never expand more than this many occurrences per event. */
const MAX_OCCURRENCES = 60

const cache = new Map<string, { at: number; text: string }>()

export type CalendarResult = { ok: true; items: AgendaItem[] } | { ok: false; error: string }

/** Calendar apps hand out `webcal://` links; they are plain https underneath. */
function parseCalendarUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim().replace(/^webcal:\/\//i, 'https://'))
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** The link comes from the user, so refuse anything that points at the server's own network. */
function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) return false
  return host.includes('.')
}

async function download(start: URL): Promise<string> {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHost(url.hostname)) throw new Error('blocked host')
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      const next = location ? parseCalendarUrl(new URL(location, url).toString()) : null
      if (!next) throw new Error('bad redirect')
      url = next
      continue
    }
    if (!response.ok) throw new Error(`status ${response.status}`)
    const text = await response.text()
    if (text.length > MAX_BYTES) throw new Error('too large')
    return text
  }
  throw new Error('too many redirects')
}

function toItem(event: VEvent, start: Date, end: Date | null, uid: string): AgendaItem {
  const allDay = event.datetype === 'date'
  // All-day events are dates, not instants: keep the calendar date and ignore the server's time zone.
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateOnly = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`
  return {
    id: `cal-${uid}-${start.getTime()}`,
    title: typeof event.summary === 'string' && event.summary.trim() ? event.summary.trim() : 'Busy',
    startsAt: allDay ? dateOnly(start) : start.toISOString(),
    endsAt: end ? (allDay ? dateOnly(end) : end.toISOString()) : null,
    notes: typeof event.location === 'string' ? event.location : '',
    allDay,
    source: 'calendar',
  }
}

function expand(event: VEvent, from: Date, to: Date): AgendaItem[] {
  const durationMs = event.end ? event.end.getTime() - event.start.getTime() : 0
  const uid = event.uid ?? event.summary ?? 'event'
  const finish = (start: Date) => (durationMs > 0 ? new Date(start.getTime() + durationMs) : null)

  if (!event.rrule) {
    const end = event.end ?? null
    const overlaps = (end ?? event.start) >= from && event.start < to
    return overlaps ? [toItem(event, event.start, end, uid)] : []
  }

  const skipped = new Set(
    Object.values(event.exdate ?? {}).flatMap((d) => (d instanceof Date ? [d.getTime()] : [])),
  )
  // Look back one event length so an occurrence that started before the window but is still running is included.
  return event.rrule
    .between(new Date(from.getTime() - durationMs), to, true)
    .slice(0, MAX_OCCURRENCES)
    .filter((start) => !skipped.has(start.getTime()))
    .map((start) => toItem(event, start, finish(start), uid))
}

/** Reads the user's private calendar link and returns the events that fall between `from` and `to`. */
export async function readCalendar(rawUrl: string, from: Date, to: Date): Promise<CalendarResult> {
  const url = parseCalendarUrl(rawUrl)
  if (!url || !isPublicHost(url.hostname)) {
    return { ok: false, error: 'The calendar link must be a public https or webcal address.' }
  }

  try {
    const cached = cache.get(url.toString())
    let text = cached && Date.now() - cached.at < CACHE_MS ? cached.text : null
    if (text === null) {
      text = await download(url)
      cache.set(url.toString(), { at: Date.now(), text })
    }

    const items: AgendaItem[] = []
    for (const component of Object.values(ical.sync.parseICS(text))) {
      if (component?.type === 'VEVENT' && component.status !== 'CANCELLED') items.push(...expand(component, from, to))
    }
    return { ok: true, items }
  } catch (err) {
    console.error('Calendar read failed:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'Could not read your calendar link. Check it in your profile.' }
  }
}
