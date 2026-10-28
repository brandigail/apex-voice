import { z } from 'zod'
import { AUTO, SAME } from '../../../src/types/languages.ts'
import { generatedDraftSchema } from '../../../src/types/draft-schema.ts'
import type { DraftCategory, GeneratedDraft } from '../../../src/types/draft.ts'
import type { Profile } from '../../../src/types/profile.ts'
import { retryPrompt, systemPrompt, userPrompt } from './draft-prompt.ts'
import { chat, type ChatMessage } from './groq-chat.ts'
import { withSignature } from './signature.ts'

/** Don't start a retry with less time than this left. */
const MIN_RETRY_MS = 2_500
const MAX_ATTEMPTS = 2

/** The model writes the text fields only; the channel is the one the user chose, never the model's guess. */
const modelDraftSchema = generatedDraftSchema.omit({ category: true, language: true }).extend({
  // A model that forgets or mangles the code should not fail the draft; assume English.
  language: z.string().toLowerCase().regex(/^[a-z]{2,3}$/).catch('en'),
})

type ParseResult = { ok: true; draft: GeneratedDraft } | { ok: false; problem: string }

function parseDraft(content: string, category: DraftCategory): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    return { ok: false, problem: 'it was not valid JSON' }
  }
  const result = modelDraftSchema.safeParse(raw)
  if (result.success) return { ok: true, draft: { ...result.data, category } }
  const problem = result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ')
  return { ok: false, problem }
}

export type DraftResult = { ok: true; draft: GeneratedDraft } | { ok: false; status: number; message: string }

export interface DraftRequest {
  apiKey: string
  category: DraftCategory
  transcript: string
  profile: Profile
  /** Time the whole call, retry included, may take. */
  deadlineMs: number
  /** A language code to write in, or "same" / undefined to write in the language that was spoken. */
  writeLanguage?: string
  spokenLanguage?: string
  /** What Apex remembers that is relevant to this dictation (see loadMemoryContext), or empty. */
  memory?: string
}

/** Turns a transcript into a validated, signed draft for one channel, retrying once if the model's JSON is invalid. */
export async function writeDraft({
  apiKey,
  category,
  transcript,
  profile,
  deadlineMs,
  writeLanguage,
  spokenLanguage,
  memory,
}: DraftRequest): Promise<DraftResult> {
  const startedAt = Date.now()
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(category, profile, writeLanguage, spokenLanguage, memory) },
    { role: 'user', content: userPrompt(transcript) },
  ]

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remaining = deadlineMs - (Date.now() - startedAt)
    if (attempt > 0 && remaining < MIN_RETRY_MS) break

    const result = await chat(apiKey, messages, remaining, { json: true })
    if (!result.ok) {
      if (result.status === 429) return { ok: false, status: 429, message: 'The AI service is busy. Try again in a moment.' }
      return { ok: false, status: result.status === 504 ? 504 : 502, message: 'Could not create a draft. Please try again.' }
    }

    const parsed = parseDraft(result.content, category)
    if (parsed.ok) {
      // A language the user chose is more reliable than the model's own label for what it wrote.
      const chosen = writeLanguage && writeLanguage !== SAME ? writeLanguage : spokenLanguage && spokenLanguage !== AUTO ? spokenLanguage : null
      const draft = chosen ? { ...parsed.draft, language: chosen } : parsed.draft
      return { ok: true, draft: withSignature(draft, profile) }
    }

    console.error('Invalid draft from model:', parsed.problem)
    messages.push({ role: 'assistant', content: result.content }, { role: 'user', content: retryPrompt(parsed.problem) })
  }

  return { ok: false, status: 502, message: 'Could not structure the transcript into a draft. Please try again.' }
}
