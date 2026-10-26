const DAY_MS = 24 * 60 * 60 * 1000

/** Falls back to UTC when the client sends a zone name this runtime doesn't know. */
export function safeTimeZone(name: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name })
    return name
  } catch {
    return 'UTC'
  }
}

/** How far the zone is ahead of UTC at an instant, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** Converts a wall-clock time such as "2026-10-29T10:00" in the user's zone to the instant it means. */
export function zonedToDate(local: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(local.trim())
  if (!match) return null
  const [, y, mo, d, h = '00', mi = '00'] = match
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  // Two passes settle on the right offset even across a daylight-saving change.
  let guess = wall - offsetMs(new Date(wall), timeZone)
  guess = wall - offsetMs(new Date(guess), timeZone)
  const result = new Date(guess)
  return Number.isNaN(result.getTime()) ? null : result
}

/** Midnight at the start of a calendar day ("2026-10-29") in the user's zone. */
export function startOfZonedDay(day: string, timeZone: string): Date | null {
  return zonedToDate(`${day.slice(0, 10)}T00:00`, timeZone)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** "Thu 29 Oct, 10:00", or "Thu 29 Oct" for an all-day item. */
export function formatWhen(iso: string, timeZone: string, allDay: boolean): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: allDay ? 'UTC' : timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  if (allDay) return day
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  return `${day}, ${time}`
}

/** The current moment in the user's words, for the system prompt: "Monday 26 October 2026, 14:05 (Africa/Johannesburg)". */
export function describeNow(timeZone: string, now = new Date()): string {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return `${text} (${timeZone})`
}

/** Today's date as YYYY-MM-DD in the user's zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
