import { extensionForMime } from '../../src/lib/audio-mime.ts'
import type { TranscribeResponse } from '../../src/types/api.ts'
import { errorResponse, json } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'
/** Netlify rejects request bodies over 6 MB; stay well under it. A 60 s clip is well below this. */
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
  try {
    audio = (await req.formData()).get('audio')
  } catch {
    return errorResponse(400, 'Send the recording as multipart form data.')
  }
  if (!(audio instanceof File) || audio.size === 0) return errorResponse(400, 'Missing audio file.')
  if (audio.size > MAX_AUDIO_BYTES) return errorResponse(413, 'Recording is too large. Keep clips under 60 seconds.')
  if (audio.type && !audio.type.startsWith('audio/') && !audio.type.startsWith('video/')) {
    return errorResponse(415, 'Unsupported file type.')
  }

  const quota = await claimQuota(session.user.id, 'transcribe')
  if (!quota.ok) return quota.response

  const upstream = new FormData()
  upstream.set('file', audio, `audio.${extensionForMime(audio.type)}`)
  upstream.set('model', GROQ_MODEL)
  upstream.set('response_format', 'json')
  upstream.set('temperature', '0')

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
    console.error('Groq request failed:', timedOut ? 'timeout' : err)
    return errorResponse(timedOut ? 504 : 502, 'Transcription service is unavailable. Please try again.')
  }

  if (!response.ok) {
    console.error('Groq transcription error:', response.status, await response.text().catch(() => ''))
    if (response.status === 429) return errorResponse(429, 'Transcription is busy. Try again in a moment.')
    return errorResponse(502, 'Transcription failed. Please try again.')
  }

  const { text } = (await response.json()) as GroqTranscription
  const transcript = text?.trim() ?? ''
  if (!transcript) return errorResponse(422, 'No speech detected. Try recording again.')

  return json<TranscribeResponse>({ text: transcript })
}
