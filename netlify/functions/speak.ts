import { z } from 'zod'
import { ASSISTANT_VOICES, MAX_SPEECH_CHARS } from '../../src/types/assistant.ts'
import { errorResponse } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'
import { describeError, describeUpstream } from './_lib/safe-log.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/speech'
const GROQ_MODEL = 'canopylabs/orpheus-v1-english'
const DEFAULT_VOICE = 'diana'
/** Netlify's default function timeout is 10 s. */
const GROQ_TIMEOUT_MS = 8_500

const requestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_SPEECH_CHARS),
  voice: z.enum(ASSISTANT_VOICES).optional(),
})

/** Turns one short piece of text into a natural-sounding voice clip. The client sends a reply a sentence or two at a time. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.')

  const session = await requireUser(req)
  if (!session.ok) return session.response

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('GROQ_API_KEY is not configured')
    return errorResponse(500, 'Server is not configured.')
  }

  const request = requestSchema.safeParse(await req.json().catch(() => null))
  if (!request.success) return errorResponse(400, `Send text of 1 to ${MAX_SPEECH_CHARS} characters.`)

  const quota = await claimQuota(session.user.id, 'speak')
  if (!quota.ok) return quota.response

  let response: Response
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        voice: request.data.voice ?? (process.env.GROQ_TTS_VOICE || DEFAULT_VOICE),
        input: request.data.text,
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    console.error('Groq speech request failed:', timedOut ? 'timeout' : describeError(err))
    return errorResponse(timedOut ? 504 : 502, 'The voice service is unavailable.')
  }

  if (!response.ok) {
    console.error('Groq speech error:', await describeUpstream(response))
    return errorResponse(response.status === 429 ? 429 : 502, 'The voice service is unavailable.')
  }

  return new Response(response.body, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } })
}
