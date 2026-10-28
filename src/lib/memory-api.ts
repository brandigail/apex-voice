import { z } from 'zod'
import { MEMORY_KINDS, type Contact, type ContactInput, type Memory, type MemoryKind, type MemoryResponse } from '../types/memory'
import { ApiRequestError, request } from './api'

const memorySchema = z.object({
  id: z.string(),
  kind: z.enum(MEMORY_KINDS),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const contactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  relationship: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const memoryResponseSchema = z.object({ memories: z.array(memorySchema), contacts: z.array(contactSchema) })

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) throw new ApiRequestError(502, 'The server sent an unexpected response.')
  return result.data
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export async function fetchMemory(): Promise<MemoryResponse> {
  return parse(memoryResponseSchema, await request('/api/memory', { method: 'GET' }))
}

export async function addMemory(kind: MemoryKind, content: string): Promise<Memory> {
  return parse(memorySchema, await request('/api/memory', jsonInit('POST', { kind, content })))
}

export async function updateMemory(id: string, kind: MemoryKind, content: string): Promise<Memory> {
  return parse(memorySchema, await request(`/api/memory/${id}`, jsonInit('PUT', { kind, content })))
}

export async function deleteMemory(id: string): Promise<void> {
  await request(`/api/memory/${id}`, { method: 'DELETE' })
}

export async function saveContact(input: ContactInput, id?: string): Promise<Contact> {
  return parse(contactSchema, await request(id ? `/api/contacts/${id}` : '/api/contacts', jsonInit(id ? 'PUT' : 'POST', input)))
}

export async function deleteContact(id: string): Promise<void> {
  await request(`/api/contacts/${id}`, { method: 'DELETE' })
}
