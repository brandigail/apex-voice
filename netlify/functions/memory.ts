import type { Config } from '@netlify/functions'
import { z } from 'zod'
import type { Memory, MemoryResponse } from '../../src/types/memory.ts'
import { MEMORY_LIMITS } from '../../src/types/memory.ts'
import { memoryInputSchema } from '../../src/types/memory-schema.ts'
import { errorResponse, json } from './_lib/http.ts'
import { addMemory, deleteMemory, listContacts, listMemories, updateMemory } from './_lib/memory-store.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { describeError } from './_lib/safe-log.ts'
import { requireUser } from './_lib/session.ts'

/** Routes are /api/memory and /api/memory/:id. */
function idFrom(req: Request): string | null {
  const [, , id] = new URL(req.url).pathname.split('/').filter(Boolean)
  return id?.replace(/\.html?$/, '') ?? null
}

/** What Apex remembers about the signed-in person: read it, add to it, correct it or delete it. */
export default async function handler(req: Request): Promise<Response> {
  const session = await requireUser(req)
  if (!session.ok) return session.response
  const userId = session.user.id
  const id = idFrom(req)

  try {
    if (req.method === 'GET' && id === null) {
      const [memories, contacts] = await Promise.all([listMemories(userId), listContacts(userId)])
      return json<MemoryResponse>({ memories, contacts })
    }

    if (req.method === 'POST' && id === null) {
      const input = memoryInputSchema.safeParse(await req.json().catch(() => null))
      if (!input.success) return errorResponse(400, `Write a note of 1 to ${MEMORY_LIMITS.content} characters.`)
      const quota = await claimQuota(userId, 'memory')
      if (!quota.ok) return quota.response
      const result = await addMemory(userId, input.data.kind, input.data.content)
      return result.ok ? json<Memory>(result.value.memory, 201) : errorResponse(409, result.message)
    }

    if (id !== null && !z.uuid().safeParse(id).success) return errorResponse(400, 'Invalid id.')

    if (req.method === 'PUT' && id !== null) {
      const input = memoryInputSchema.safeParse(await req.json().catch(() => null))
      if (!input.success) return errorResponse(400, `Write a note of 1 to ${MEMORY_LIMITS.content} characters.`)
      const quota = await claimQuota(userId, 'memory')
      if (!quota.ok) return quota.response
      const memory = await updateMemory(userId, id, input.data.kind, input.data.content)
      return memory ? json<Memory>(memory) : errorResponse(404, 'That memory was not found.')
    }

    if (req.method === 'DELETE' && id !== null) {
      return (await deleteMemory(userId, id)) ? json({ id }) : errorResponse(404, 'That memory was not found.')
    }

    return errorResponse(405, 'Method not allowed.')
  } catch (err) {
    console.error('Memory request failed:', describeError(err))
    return errorResponse(500, 'Could not reach your memory. Please try again.')
  }
}

export const config: Config = { path: ['/api/memory', '/api/memory/*'] }
