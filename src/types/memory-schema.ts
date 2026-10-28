import { z } from 'zod'
import { MEMORY_KINDS, MEMORY_LIMITS, type ContactInput } from './memory.ts'

// Shared by the client and the Netlify Functions. Keep this file free of DOM and Node APIs.

export const memoryInputSchema = z.object({
  kind: z.enum(MEMORY_KINDS),
  content: z.string().trim().min(1).max(MEMORY_LIMITS.content),
})

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(MEMORY_LIMITS.name),
  email: z.string().trim().max(MEMORY_LIMITS.email).default(''),
  phone: z.string().trim().max(MEMORY_LIMITS.phone).default(''),
  relationship: z.string().trim().max(MEMORY_LIMITS.relationship).default(''),
  notes: z.string().trim().max(MEMORY_LIMITS.notes).default(''),
}) satisfies z.ZodType<ContactInput, unknown>
