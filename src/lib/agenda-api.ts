import { z } from 'zod'
import { agendaItemSchema, agendaResponseSchema } from '../types/agenda-schema'
import type { AgendaItem, AgendaResponse, NewAgendaItem } from '../types/agenda'
import { ApiRequestError, request } from './api'

const unexpected = () => new ApiRequestError(502, 'The server sent an unexpected response.')

export async function listAgenda(from: Date, to: Date): Promise<AgendaResponse> {
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  const data = agendaResponseSchema.safeParse(await request(`/api/agenda?${query}`, { method: 'GET' }))
  if (!data.success) throw unexpected()
  return data.data
}

export async function addAgendaItem(item: NewAgendaItem): Promise<AgendaItem> {
  const data = z
    .object({ item: agendaItemSchema })
    .safeParse(await request('/api/agenda', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }))
  if (!data.success) throw unexpected()
  return data.data.item
}

export async function deleteAgendaItem(id: string): Promise<void> {
  await request(`/api/agenda/${id}`, { method: 'DELETE' })
}
