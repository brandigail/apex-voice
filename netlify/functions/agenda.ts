import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { newAgendaItemSchema } from '../../src/types/agenda-schema.ts'
import type { AgendaResponse } from '../../src/types/agenda.ts'
import { addAgendaItem, deleteAgendaItem, listAgenda } from './_lib/agenda.ts'
import { errorResponse, json } from './_lib/http.ts'
import { requireUser } from './_lib/session.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_SPAN_DAYS = 14
const MAX_SPAN_DAYS = 62

/** Routes are /api/agenda and /api/agenda/:id. */
function itemIdFrom(req: Request): string | null {
  const [, , id] = new URL(req.url).pathname.split('/').filter(Boolean)
  return id?.replace(/\.html?$/, '') ?? null
}

function windowFrom(url: URL): { from: Date; to: Date } | null {
  const now = new Date()
  const from = url.searchParams.has('from') ? new Date(url.searchParams.get('from') ?? '') : new Date(now.getTime() - DAY_MS)
  const to = url.searchParams.has('to')
    ? new Date(url.searchParams.get('to') ?? '')
    : new Date(from.getTime() + (DEFAULT_SPAN_DAYS + 1) * DAY_MS)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return null
  return to.getTime() - from.getTime() > MAX_SPAN_DAYS * DAY_MS ? null : { from, to }
}

export default async function handler(req: Request): Promise<Response> {
  const session = await requireUser(req)
  if (!session.ok) return session.response
  const { id: userId, profile } = session.user
  const id = itemIdFrom(req)

  try {
    if (req.method === 'GET' && id === null) {
      const range = windowFrom(new URL(req.url))
      if (!range) return errorResponse(400, `Ask for a valid date range of up to ${MAX_SPAN_DAYS} days.`)
      return json<AgendaResponse>(await listAgenda(userId, profile.calendarUrl, range.from, range.to))
    }

    if (req.method === 'POST' && id === null) {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse(400, 'Send a JSON body.')
      }
      const parsed = newAgendaItemSchema.safeParse(body)
      if (!parsed.success) return errorResponse(400, 'That agenda item is not valid.')
      const added = await addAgendaItem(userId, parsed.data)
      return added.ok ? json({ item: added.item }, 201) : errorResponse(403, added.message)
    }

    if (req.method === 'DELETE' && id !== null) {
      if (!z.uuid().safeParse(id).success) return errorResponse(400, 'Invalid agenda id.')
      return (await deleteAgendaItem(userId, id)) ? json({ id }) : errorResponse(404, 'Agenda item not found.')
    }

    return errorResponse(405, 'Method not allowed.')
  } catch (err) {
    console.error('Agenda request failed:', err)
    return errorResponse(500, 'Could not reach your agenda. Please try again.')
  }
}

export const config: Config = { path: ['/api/agenda', '/api/agenda/*'] }
