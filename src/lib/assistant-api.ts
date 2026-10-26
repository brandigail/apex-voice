import { z } from 'zod'
import type { AssistantRequest, AssistantResponse, AssistantTurn, AssistantVoice } from '../types/assistant'
import { MAX_SPEECH_CHARS } from '../types/assistant'
import { ApiRequestError, request } from './api'

const REPLY_TIMEOUT_MS = 15_000

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('draft_created'), id: z.string(), category: z.string(), label: z.string() }),
  z.object({ type: z.literal('agenda_added'), id: z.string(), label: z.string() }),
  z.object({ type: z.literal('marked_sent'), id: z.string(), label: z.string() }),
  z.object({ type: z.literal('send_scheduled'), id: z.string(), label: z.string() }),
])
const responseSchema = z.object({
  reply: z.string().min(1),
  actions: z.array(actionSchema),
  speechLanguage: z.string().optional(),
})

/** Sends the conversation so far and gets the assistant's spoken-style reply plus anything it did. */
export async function askAssistant(
  messages: AssistantTurn[],
  conversationId: string,
  spokenLanguage: string,
): Promise<AssistantResponse> {
  const payload: AssistantRequest = {
    messages,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    conversationId,
    spokenLanguage,
  }
  const data = responseSchema.safeParse(
    await request('/api/assistant', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  )
  if (!data.success) throw new ApiRequestError(502, 'The server sent an unexpected reply.')
  return data.data as AssistantResponse
}

/** Fetches one short piece of text (up to {@link MAX_SPEECH_CHARS} characters) as a spoken audio clip. */
export async function fetchSpeech(text: string, voice: AssistantVoice): Promise<Blob> {
  let response: Response
  try {
    response = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, MAX_SPEECH_CHARS), voice }),
      signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
    })
  } catch {
    throw new ApiRequestError(0, 'Network error.')
  }
  if (!response.ok) throw new ApiRequestError(response.status, 'The voice service is unavailable.')
  return response.blob()
}
