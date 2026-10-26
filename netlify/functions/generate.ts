import type { GenerateResponse } from '../../src/types/api.ts'
import { generateRequestSchema, generatedDraftSchema } from '../../src/types/draft-schema.ts'
import type { DraftCategory, GeneratedDraft } from '../../src/types/draft.ts'
import { retryPrompt, systemPrompt, userPrompt } from './_lib/draft-prompt.ts'
import { errorResponse, json } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'
import { withSignature } from './_lib/signature.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'
/** Netlify's default function timeout is 10 s; the whole call, retry included, must fit inside it. */
const DEADLINE_MS = 9_000
/** Don't start a retry with less time than this left. */
const MIN_RETRY_MS = 2_500
const MAX_ATTEMPTS = 2

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqChatResponse {
  choices?: { message?: { content?: string | null } }[]
}

type ChatResult = { ok: true; content: string } | { ok: false; status: number }

async function chat(apiKey: string, messages: ChatMessage[], timeoutMs: number): Promise<ChatResult> {
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      console.error('Groq chat error:', response.status, await response.text().catch(() => ''))
      return { ok: false, status: response.status }
    }
    const data = (await response.json()) as GroqChatResponse
    return { ok: true, content: data.choices?.[0]?.message?.content ?? '' }
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    console.error('Groq chat request failed:', timedOut ? 'timeout' : err)
    return { ok: false, status: timedOut ? 504 : 502 }
  }
}

type ParseResult = { ok: true; draft: GeneratedDraft } | { ok: false; problem: string }

/** The model writes the text fields only; the channel is the one the user chose, never the model's guess. */
const modelDraftSchema = generatedDraftSchema.omit({ category: true })

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.')

  const session = await requireUser(req)
  if (!session.ok) return session.response

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('GROQ_API_KEY is not configured')
    return errorResponse(500, 'Server is not configured.')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'Send a JSON body.')
  }
  const request = generateRequestSchema.safeParse(body)
  if (!request.success) return errorResponse(400, 'A transcript of 1 to 10,000 characters is required.')

  const quota = await claimQuota(session.user.id, 'generate')
  if (!quota.ok) return quota.response

  const { profile } = session.user
  const { category, transcript } = request.data
  const startedAt = Date.now()
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(category, profile) },
    { role: 'user', content: userPrompt(transcript) },
  ]

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remaining = DEADLINE_MS - (Date.now() - startedAt)
    if (attempt > 0 && remaining < MIN_RETRY_MS) break

    const result = await chat(apiKey, messages, remaining)
    if (!result.ok) {
      if (result.status === 429) return errorResponse(429, 'The AI service is busy. Try again in a moment.')
      return errorResponse(result.status === 504 ? 504 : 502, 'Could not create a draft. Please try again.')
    }

    const parsed = parseDraft(result.content, category)
    if (parsed.ok) return json<GenerateResponse>({ draft: withSignature(parsed.draft, profile) })

    console.error('Invalid draft from model:', parsed.problem)
    messages.push({ role: 'assistant', content: result.content }, { role: 'user', content: retryPrompt(parsed.problem) })
  }

  return errorResponse(502, 'Could not structure the transcript into a draft. Please try again.')
}
