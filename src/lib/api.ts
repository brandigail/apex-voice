import { z } from 'zod'
import type { ApiError, GenerateRequest } from '../types/api'
import { generatedDraftSchema } from '../types/draft-schema'
import type { DraftCategory, GeneratedDraft } from '../types/draft'
import { extensionForMime } from './audio-mime'

const REQUEST_TIMEOUT_MS = 20_000

export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

const transcribeResponseSchema = z.object({ text: z.string().min(1) })
const generateResponseSchema = z.object({ draft: generatedDraftSchema })

export async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      method: init.method ?? 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    throw new ApiRequestError(0, timedOut ? 'The request timed out. Please try again.' : 'Network error. Check your connection.')
  }

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    try {
      const body = (await response.json()) as Partial<ApiError>
      if (typeof body.error === 'string') message = body.error
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new ApiRequestError(response.status, message)
  }

  try {
    return await response.json()
  } catch {
    throw new ApiRequestError(502, 'The server sent an unreadable response.')
  }
}

/**
 * `forAssistant` bills the clip to the assistant's own quota instead of the one-off recording quota.
 * `language` is the language being spoken, or "auto".
 */
export async function transcribeAudio(blob: Blob, mimeType: string, forAssistant = false, language = 'auto'): Promise<string> {
  const form = new FormData()
  form.set('audio', blob, `recording.${extensionForMime(mimeType)}`)
  form.set('language', language)
  const path = forAssistant ? '/api/transcribe?for=assistant' : '/api/transcribe'
  const data = transcribeResponseSchema.safeParse(await request(path, { body: form }))
  if (!data.success) throw new ApiRequestError(502, 'The server sent an unexpected response.')
  return data.data.text
}

/**
 * Transcribes a recording made of several clips and joins the text in order. A clip that is only silence counts as
 * empty rather than as an error, because a long recording can easily contain one.
 */
export async function transcribeRecording(
  segments: Blob[],
  mimeType: string,
  language: string,
  forAssistant = false,
): Promise<string> {
  const parts = await Promise.all(
    segments.map((clip) =>
      transcribeAudio(clip, mimeType, forAssistant, language).catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 422) return ''
        throw err
      }),
    ),
  )
  return parts.join(' ').trim()
}

export async function generateDraft(
  transcript: string,
  category: DraftCategory,
  writeLanguage: string,
  spokenLanguage: string,
): Promise<GeneratedDraft> {
  const payload: GenerateRequest = { transcript, category, writeLanguage, spokenLanguage }
  const data = generateResponseSchema.safeParse(
    await request('/api/generate', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
  if (!data.success) throw new ApiRequestError(502, 'The server sent an unexpected draft.')
  return data.data.draft
}
