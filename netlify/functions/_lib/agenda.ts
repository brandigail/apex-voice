import { neon } from '@neondatabase/serverless'
import type { AgendaItem, AgendaResponse, NewAgendaItem } from '../../../src/types/agenda.ts'
import { readCalendar } from './calendar.ts'

/** Most things one user can keep on their own agenda. */
export const MAX_AGENDA_ITEMS = 500

interface AgendaRow {
  id: string
  title: string
  starts_at: string | Date
  ends_at: string | Date | null
  notes: string
}

function toItem(row: AgendaRow): AgendaItem {
  return {
    id: row.id,
    title: row.title,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    notes: row.notes,
    allDay: false,
    source: 'apex',
  }
}

const byStart = (a: AgendaItem, b: AgendaItem) => a.startsAt.localeCompare(b.startsAt)

/** Apex items plus, when the user linked one, events from their calendar, soonest first. */
export async function listAgenda(userId: string, calendarUrl: string, from: Date, to: Date): Promise<AgendaResponse> {
  const sql = neon(process.env.DATABASE_URL ?? '')
  const [rows, calendar] = await Promise.all([
    sql.query(
      `SELECT id, title, starts_at, ends_at, notes FROM agenda_items
       WHERE user_id = $1 AND COALESCE(ends_at, starts_at) >= $2 AND starts_at < $3
       ORDER BY starts_at LIMIT 200`,
      [userId, from.toISOString(), to.toISOString()],
    ) as unknown as Promise<AgendaRow[]>,
    calendarUrl ? readCalendar(calendarUrl, from, to) : Promise.resolve(null),
  ])

  const items = rows.map(toItem)
  if (calendar?.ok) items.push(...calendar.items)
  return {
    items: items.sort(byStart),
    calendarLinked: calendarUrl !== '',
    calendarError: calendar && !calendar.ok ? calendar.error : null,
  }
}

export type AddResult = { ok: true; item: AgendaItem } | { ok: false; message: string }

export async function addAgendaItem(userId: string, input: NewAgendaItem): Promise<AddResult> {
  const sql = neon(process.env.DATABASE_URL ?? '')
  const [{ total }] = (await sql.query('SELECT count(*)::int AS total FROM agenda_items WHERE user_id = $1', [userId])) as {
    total: number
  }[]
  if (total >= MAX_AGENDA_ITEMS) return { ok: false, message: `You can keep up to ${MAX_AGENDA_ITEMS} agenda items. Delete some first.` }

  const rows = (await sql.query(
    `INSERT INTO agenda_items (user_id, title, starts_at, ends_at, notes) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, starts_at, ends_at, notes`,
    [userId, input.title, input.startsAt, input.endsAt, input.notes],
  )) as AgendaRow[]
  return { ok: true, item: toItem(rows[0]) }
}

export async function deleteAgendaItem(userId: string, id: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL ?? '')
  const rows = await sql.query('DELETE FROM agenda_items WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId])
  return rows.length > 0
}
