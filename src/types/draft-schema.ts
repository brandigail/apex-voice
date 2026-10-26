import { z } from 'zod'
import type { GenerateRequest } from './api.ts'
import { DRAFT_CATEGORIES, type Draft, type DraftStatusUpdate, type GeneratedDraft, type SaveDraftInput } from './draft.ts'
import { SPOKEN_CODES, WRITE_CODES } from './languages.ts'

// Shared by the client and the Netlify Functions. Keep this file free of DOM and Node APIs.

export const MAX_TRANSCRIPT_LENGTH = 10_000

export const generatedDraftSchema = z.object({
  category: z.enum(DRAFT_CATEGORIES),
  recipient: z.string().max(200),
  subject: z.string().max(300),
  body: z.string().min(1).max(MAX_TRANSCRIPT_LENGTH),
  language: z.string().regex(/^[a-z]{2,3}$/),
}) satisfies z.ZodType<GeneratedDraft>

export const generateRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(MAX_TRANSCRIPT_LENGTH),
  category: z.enum(DRAFT_CATEGORIES),
  writeLanguage: z.string().refine((code) => WRITE_CODES.includes(code)).optional(),
  spokenLanguage: z.string().refine((code) => SPOKEN_CODES.includes(code)).optional(),
}) satisfies z.ZodType<GenerateRequest>

export const draftSchema = generatedDraftSchema.extend({
  id: z.uuid(),
  transcript: z.string().max(MAX_TRANSCRIPT_LENGTH),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
  sendAt: z.iso.datetime().nullable(),
}) satisfies z.ZodType<Draft>

export const saveDraftSchema = draftSchema.omit({ sentAt: true, sendAt: true }) satisfies z.ZodType<SaveDraftInput>

export const draftStatusSchema = z
  .object({ sent: z.boolean().optional(), sendAt: z.iso.datetime({ offset: true }).nullable().optional() })
  .refine((update) => update.sent !== undefined || update.sendAt !== undefined, 'Nothing to change.') satisfies z.ZodType<DraftStatusUpdate>
