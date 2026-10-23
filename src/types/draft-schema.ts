import { z } from 'zod'
import { DRAFT_CATEGORIES, type Draft, type GeneratedDraft } from './draft.ts'

// Shared by the client and the Netlify Functions. Keep this file free of DOM and Node APIs.

export const MAX_TRANSCRIPT_LENGTH = 10_000

export const generatedDraftSchema = z.object({
  category: z.enum(DRAFT_CATEGORIES),
  recipient: z.string().max(200),
  subject: z.string().max(300),
  body: z.string().min(1).max(MAX_TRANSCRIPT_LENGTH),
}) satisfies z.ZodType<GeneratedDraft>

export const draftSchema = generatedDraftSchema.extend({
  id: z.uuid(),
  transcript: z.string().max(MAX_TRANSCRIPT_LENGTH),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}) satisfies z.ZodType<Draft>
