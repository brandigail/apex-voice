import { z } from 'zod'
import type { CalendarCheckResponse } from '../../src/types/agenda.ts'
import { readCalendar } from './_lib/calendar.ts'
import { errorResponse, json } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const LOOK_AHEAD_DAYS = 30
const PREVIEW_EVENTS = 3

const requestSchema = z.object({ url: z.string().trim().min(8).max(500) })

/** Tries a calendar link before it is saved, so a wrong or private one is caught while the user is still setting it up. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.')
  const session = await requireUser(req)
  if (!session.ok) return session.response

  const request = requestSchema.safeParse(await req.json().catch(() => null))
  if (!request.success) return errorResponse(400, 'Send the calendar link.')

  const quota = await claimQuota(session.user.id, 'calendar')
  if (!quota.ok) return quota.response

  const now = new Date()
  const result = await readCalendar(request.data.url, now, new Date(now.getTime() + LOOK_AHEAD_DAYS * DAY_MS))
  if (!result.ok) return json<CalendarCheckResponse>({ ok: false, error: result.error, count: 0, next: [] })

  const upcoming = result.items.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return json<CalendarCheckResponse>({
    ok: true,
    error: null,
    count: upcoming.length,
    next: upcoming.slice(0, PREVIEW_EVENTS).map(({ title, startsAt, allDay }) => ({ title, startsAt, allDay })),
  })
}
