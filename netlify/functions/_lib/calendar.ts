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

const GOOGLE_HINT =
  'In Google Calendar copy the "Secret address in iCal format". It starts with https://calendar.google.com/calendar/ical/ and ends in basic.ics.'

/** A pasted web page address (rather than the calendar's iCal address) is the most common mistake; say so straight away. */
function wrongLinkKind(url: URL): string | null {
  const isGoogle = url.hostname === 'calendar.google.com'
  if (isGoogle && !url.pathname.includes('/ical/')) {
    return `That is the address of a Google Calendar web page, not the calendar link. ${GOOGLE_HINT}`
  }
  return null
}

/** Turns a failed download into something a person can act on. */
function friendlyError(message: string, url: URL): string {
  const status = /^status (\d+)$/.exec(message)?.[1]
  const google = url.hostname === 'calendar.google.com' ? ` ${GOOGLE_HINT}` : ''
  if (status === '401' || status === '403') {
    return `That link asks for a sign-in, so it is not the private calendar address.${google || ' Look for a "secret" or "private" iCal / ICS address in your calendar settings.'}`
  }
  if (status === '404' || status === '410') {
    return `That calendar address was not found. If you reset the secret address, copy the new one.${google}`
  }
  if (message === 'too large') return 'That calendar is too big to read. Try a calendar with fewer events.'
  return 'Could not read your calendar link. Check it in your profile.'
}

/** Reads the user's private calendar link and returns the events that fall between `from` and `to`. */
export async function readCalendar(rawUrl: string, from: Date, to: Date): Promise<CalendarResult> {
  const url = parseCalendarUrl(rawUrl)
  if (!url || !isPublicHost(url.hostname)) {
    return { ok: false, error: 'The calendar link must be a public https or webcal address.' }
  }
  const wrong = wrongLinkKind(url)
  if (wrong) return { ok: false, error: wrong }

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
    const message = err instanceof Error ? err.message : String(err)
    console.error('Calendar read failed:', message)
    return { ok: false, error: friendlyError(message, url) }
  }
}
