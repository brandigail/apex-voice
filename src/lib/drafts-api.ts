import { z } from 'zod'
import type { Draft, SaveDraftInput } from '../types/draft'
import { draftSchema } from '../types/draft-schema'
import { ApiRequestError, request } from './api'

const listResponseSchema = z.object({ drafts: z.array(draftSchema) })
const saveResponseSchema = z.object({ draft: draftSchema })

const unexpected = () => new ApiRequestError(502, 'The server sent an unexpected response.')

export async function listDrafts(): Promise<Draft[]> {
  const data = listResponseSchema.safeParse(await request('/api/drafts', { method: 'GET' }))
  if (!data.success) throw unexpected()
  return data.data.drafts
}

/** Creates the draft, or updates it if the id already exists. */
export async function saveDraft(draft: SaveDraftInput): Promise<Draft> {
  const data = saveResponseSchema.safeParse(
    await request(`/api/drafts/${draft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    }),
  )
  if (!data.success) throw unexpected()
  return data.data.draft
}

/** Records that the user sent the draft (or takes that back). */
export async function markDraftSent(id: string, sent: boolean): Promise<Draft> {
  const data = saveResponseSchema.safeParse(
    await request(`/api/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent }),
    }),
  )
  if (!data.success) throw unexpected()
  return data.data.draft
}

export async function deleteDraft(id: string): Promise<void> {
  await request(`/api/drafts/${id}`, { method: 'DELETE' })
}
