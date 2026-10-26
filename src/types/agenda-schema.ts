import { z } from 'zod'
import type { AgendaItem, AgendaResponse, NewAgendaItem } from './agenda.ts'

// Shared by the client and the Netlify Functions. Keep this file free of DOM and Node APIs.

export const newAgendaItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  notes: z.string().trim().max(500),
}) satisfies z.ZodType<NewAgendaItem>

export const agendaItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  notes: z.string(),
  allDay: z.boolean(),
  source: z.enum(['apex', 'calendar']),
}) satisfies z.ZodType<AgendaItem>

export const agendaResponseSchema = z.object({
  items: z.array(agendaItemSchema),
  calendarError: z.string().nullable(),
  calendarLinked: z.boolean(),
}) satisfies z.ZodType<AgendaResponse>
