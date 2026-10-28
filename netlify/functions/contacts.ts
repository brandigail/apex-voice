import type { Config } from '@netlify/functions'
import { z } from 'zod'
import type { Contact } from '../../src/types/memory.ts'
import { contactInputSchema } from '../../src/types/memory-schema.ts'
import { errorResponse, json } from './_lib/http.ts'
import { deleteContact, saveContact, updateContact } from './_lib/memory-store.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { describeError } from './_lib/safe-log.ts'
import { requireUser } from './_lib/session.ts'

/** Routes are /api/contacts and /api/contacts/:id. Listing is part of GET /api/memory. */
function idFrom(req: Request): string | null {
  const [, , id] = new URL(req.url).pathname.split('/').filter(Boolean)
  return id?.replace(/\.html?$/, '') ?? null
}

/** The people Apex knows: add, correct or delete one. */
export default async function handler(req: Request): Promise<Response> {
  const session = await requireUser(req)
  if (!session.ok) return session.response
  const userId = session.user.id
  const id = idFrom(req)

  try {
    if (id !== null && !z.uuid().safeParse(id).success) return errorResponse(400, 'Invalid id.')

    if (req.method === 'DELETE' && id !== null) {
      return (await deleteContact(userId, id)) ? json({ id }) : errorResponse(404, 'That contact was not found.')
    }

    if ((req.method === 'POST' && id === null) || (req.method === 'PUT' && id !== null)) {
      const input = contactInputSchema.safeParse(await req.json().catch(() => null))
      if (!input.success) return errorResponse(400, 'A contact needs a name, and each detail must be short.')
      const quota = await claimQuota(userId, 'memory')
      if (!quota.ok) return quota.response

      if (id !== null) {
        const contact = await updateContact(userId, id, input.data)
        return contact ? json<Contact>(contact) : errorResponse(404, 'That contact was not found.')
      }
      const result = await saveContact(userId, input.data)
      return result.ok ? json<Contact>(result.value.contact, result.value.created ? 201 : 200) : errorResponse(409, result.message)
    }

    return errorResponse(405, 'Method not allowed.')
  } catch (err) {
    console.error('Contact request failed:', describeError(err))
    return errorResponse(500, 'Could not reach your contacts. Please try again.')
  }
}

export const config: Config = { path: ['/api/contacts', '/api/contacts/*'] }
