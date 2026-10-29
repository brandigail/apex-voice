import { extensionForMime } from '../../src/lib/audio-mime.ts'
import type { TranscribeResponse } from '../../src/types/api.ts'
import { AUTO, SPOKEN_CODES } from '../../src/types/languages.ts'
import { transcriptionPrompt } from './_lib/draft-prompt.ts'
import { errorResponse, json } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'
import { logActivity } from './_lib/activity.ts'
import { describeError, describeUpstream } from './_lib/safe-log.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
/** Fast, and accurate for English. */
const ENGLISH_MODEL = 'whisper-large-v3-turbo'
/** Slower but noticeably better at Afrikaans and other languages, and at telling languages apart. */
const MULTILINGUAL_MODEL = 'whisper-large-v3'
/** Netlify rejects request bodies over 6 MB; stay well under it. Clips are cut at 45 s, far below this. */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024
/** Netlify's default function timeout is 10 s. */
const GROQ_TIMEOUT_MS = 8_500

interface GroqTranscription {
  text?: string
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

  let audio: File | string | null
  let requested: unknown
  try {
    const form = await req.formData()
    audio = form.get('audio')
    requested = form.get('language')
  } catch {
    return errorResponse(400, 'Send the recording as multipart form data.')
  }
  if (!(audio instanceof File) || audio.size === 0) return errorResponse(400, 'Missing audio file.')
  if (audio.size > MAX_AUDIO_BYTES) return errorResponse(413, 'That clip is too large to send.')
  const language = typeof requested === 'string' && SPOKEN_CODES.includes(requested) ? requested : AUTO
  if (audio.type && !audio.type.startsWith('audio/') && !audio.type.startsWith('video/')) {
    return errorResponse(415, 'Unsupported file type.')
  }

  // Assistant conversations send many short clips, so they are metered separately from one-off recordings.
  const forAssistant = new URL(req.url).searchParams.get('for') === 'assistant'
  const quota = await claimQuota(session.user.id, forAssistant ? 'listen' : 'transcribe')
  if (!quota.ok) return quota.response

  const upstream = new FormData()
  upstream.set('file', audio, `audio.${extensionForMime(audio.type)}`)
  upstream.set('model', language === 'en' ? ENGLISH_MODEL : MULTILINGUAL_MODEL)
  upstream.set('response_format', 'json')
  upstream.set('temperature', '0')
  // Naming the language stops Whisper mistaking Afrikaans for Dutch; "auto" lets it decide.
  if (language !== AUTO) upstream.set('language', language)
  // The spelling hints are English words, so they would only confuse a recording in another language.
  if (language === 'en') upstream.set('prompt', transcriptionPrompt(session.user.profile))

  let response: Response
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    console.error('Groq request failed:', timedOut ? 'timeout' : describeError(err))
    await logActivity(session.user, 'transcribe_failed', { reason: timedOut ? 'timeout' : 'network', bytes: audio.size, mime: audio.type })
    return errorResponse(timedOut ? 504 : 502, 'Transcription service is unavailable. Please try again.')
  }

  if (!response.ok) {
    const upstreamProblem = await describeUpstream(response)
    console.error('Groq transcription error:', upstreamProblem)
    await logActivity(session.user, 'transcribe_failed', { reason: upstreamProblem, bytes: audio.size, mime: audio.type })
    if (response.status === 429) return errorResponse(429, 'Transcription is busy. Try again in a moment.')
    return errorResponse(502, 'Transcription failed. Please try again.')
  }

  const { text } = (await response.json()) as GroqTranscription
  const transcript = text?.trim() ?? ''
  if (!transcript) {
    await logActivity(session.user, 'transcribe_empty', { bytes: audio.size, mime: audio.type, forAssistant })
    return errorResponse(422, 'No speech detected. Try recording again.')
  }
  await logActivity(session.user, 'transcribed', { text: transcript, language, bytes: audio.size, mime: audio.type, forAssistant })

  return json<TranscribeResponse>({ text: transcript })
}
