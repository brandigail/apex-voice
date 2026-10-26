import { fetchSpeech } from '../../lib/assistant-api'
import { ApiRequestError } from '../../lib/api'
import { MAX_SPEECH_CHARS, READ_BACK_QUESTION } from '../../types/assistant'
import { DEVICE_VOICE, readStoredVoice, type VoiceChoice } from './voice'

/** Keep each request a little under the model's limit so a trailing space or quote never tips it over. */
const CHUNK_CHARS = MAX_SPEECH_CHARS - 12
/** Chunks fetched ahead of the one being played, so a long answer flows without gaps. */
const PREFETCH = 2
/** The first piece of a reply is kept short so the first sound arrives sooner; the rest is cut at the full size. */
const FIRST_CHUNK_CHARS = 110
/** After the hosted voice refuses a request (its free daily or per-minute limit), use the device voice for this long. */
const HOSTED_PAUSE_MS = 60_000
const BROWSER_SPEECH_BASE_MS = 4_000
const BROWSER_SPEECH_MS_PER_CHAR = 90
/** One silent, valid WAV. Playing it from a tap "unlocks" audio on iOS so later replies may play on their own. */
const SILENCE =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='

/** Tidies written text so the voice says it the way a person would: "R6,000" becomes "6,000 rand", symbols and markup are dropped. */
export function forSpeech(text: string): string {
  return text
    .replace(/\bR\s?(\d{1,3}(?:[ ,]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/g, '$1 rand')
    .replace(/(\d)\s?%/g, '$1 percent')
    .replace(/&/g, ' and ')
    .replace(/[*_#~`>|]/g, '')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/([,;:])\s*\n+\s*/g, '$1 ')
    .replace(/([^.!?,;:\s])\s*\n+\s*/g, '$1. ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits a reply into pieces the voice model accepts, breaking at sentence ends first, then commas, then spaces. */
export function splitForSpeech(text: string, max = CHUNK_CHARS, firstMax = FIRST_CHUNK_CHARS): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []
  const pieces: string[] = []
  for (const raw of sentences) {
    let rest = raw.trim()
    for (;;) {
      const limit = pieces.length === 0 ? firstMax : max
      if (rest.length <= limit) break
      const window = rest.slice(0, limit)
      // Prefer a natural pause (a comma) over the middle of a phrase.
      const pause = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '))
      const cut = pause > limit / 3 ? pause : window.lastIndexOf(' ')
      const at = cut > limit / 3 ? cut + 1 : limit
      pieces.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) pieces.push(rest)
  }

  // Join short neighbours so the voice gets natural phrases, but keep the very first piece short so sound starts sooner.
  const chunks: string[] = []
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1]
    const limit = chunks.length === 1 ? firstMax : max
    if (last !== undefined && last.length + 1 + piece.length <= limit) chunks[chunks.length - 1] = `${last} ${piece}`
    else chunks.push(piece)
  }
  return chunks
}

/** The most natural-sounding voice the browser has, used when the hosted voice is unavailable or the device voice is chosen. */
function pickBrowserVoice(language = 'en'): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(language))
  const preferred = [/natural/i, /online/i, /google/i, /samantha|ava|serena|karen/i]
  for (const pattern of preferred) {
    const match = voices.find((voice) => pattern.test(voice.name))
    if (match) return match
  }
  return voices[0]
}

export type SpeechEngine = 'voice' | 'browser'

/** The fixed phrases that are recorded once per voice (see scripts/make-voice-clips.mjs) and play instantly. */
type ClipName = 'sample' | 'greeting' | 'readback'
const clipUrl = (voice: string, name: ClipName) => `/voice/${voice}/${name}.wav`

const SAMPLE_TEXT = "Hi, I'm Apex. This is how I'll sound when we talk."
let hostedPausedUntil = 0

/** Speaks replies out loud: recorded clips for fixed phrases, the hosted natural voice for the rest, the device voice as a fallback. */
export class SpeechPlayer {
  private readonly audio = new Audio()
  private abort: AbortController | null = null

  /** Call from a tap or click, before the first reply. */
  unlock(): void {
    this.audio.src = SILENCE
    void this.audio.play().catch(() => undefined)
  }

  stop(): void {
    this.abort?.abort()
    this.abort = null
    this.audio.pause()
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  }

  private begin(): AbortController {
    this.stop()
    const abort = new AbortController()
    this.abort = abort
    return abort
  }

  /** The opening line of a conversation. Instant when a recording exists for the chosen voice. */
  async speakGreeting(text: string): Promise<SpeechEngine> {
    const voice = readStoredVoice()
    if (voice !== DEVICE_VOICE) {
      const abort = this.begin()
      if (await this.playClip(voice, 'greeting', abort.signal)) return 'voice'
    }
    return this.speak(text)
  }

  /** The "Hear it" sample. Instant when a recording exists for the chosen voice. */
  async playSample(): Promise<SpeechEngine> {
    const voice = readStoredVoice()
    if (voice !== DEVICE_VOICE) {
      const abort = this.begin()
      if (await this.playClip(voice, 'sample', abort.signal)) return 'voice'
    }
    return this.speak(SAMPLE_TEXT)
  }

  /** Resolves when the whole reply has been spoken, or as soon as {@link stop} is called. */
  async speak(text: string, language?: string): Promise<SpeechEngine> {
    const abort = this.begin()
    const voice = readStoredVoice()
    // The hosted voice only speaks English, has a free daily limit, and needs a moment to start. The device voice is
    // used for other languages, when the user prefers it, and for a minute after the hosted voice refused a request.
    if ((language && language !== 'en') || voice === DEVICE_VOICE || Date.now() < hostedPausedUntil) {
      await this.speakWithBrowser(forSpeech(text), abort.signal, language)
      return 'browser'
    }

    // The question after a draft is always the same, so it is played from a recording instead of being generated.
    const trimmed = text.trim()
    const endsWithQuestion = trimmed.endsWith(READ_BACK_QUESTION)
    const main = endsWithQuestion ? trimmed.slice(0, -READ_BACK_QUESTION.length).trim() : trimmed
    const engine = main ? await this.speakHosted(main, voice, abort) : 'voice'
    if (abort.signal.aborted || !endsWithQuestion) return engine
    if (engine === 'voice' && (await this.playClip(voice, 'readback', abort.signal))) return engine
    if (engine === 'voice') return this.speakHosted(READ_BACK_QUESTION, voice, abort)
    await this.speakWithBrowser(READ_BACK_QUESTION, abort.signal)
    return 'browser'
  }

  private async speakHosted(text: string, voice: Exclude<VoiceChoice, typeof DEVICE_VOICE>, abort: AbortController): Promise<SpeechEngine> {
    const chunks = splitForSpeech(forSpeech(text))
    const fetched = new Map<number, Promise<Blob>>()
    const fetchChunk = (index: number): Promise<Blob> | undefined => {
      if (index >= chunks.length) return undefined
      let pending = fetched.get(index)
      if (!pending) {
        pending = fetchSpeech(chunks[index], voice)
        pending.catch(() => undefined) // a failure is handled where the chunk is awaited
        fetched.set(index, pending)
      }
      return pending
    }
    for (let i = 0; i <= PREFETCH; i++) fetchChunk(i)

    for (let i = 0; i < chunks.length; i++) {
      let clip: Blob
      try {
        clip = await (fetchChunk(i) as Promise<Blob>)
      } catch (err) {
        if (abort.signal.aborted) return 'voice'
        // The free voice service allows few requests; when it says no, switch to the device voice straight away.
        if (err instanceof ApiRequestError && (err.status === 429 || err.status === 503)) hostedPausedUntil = Date.now() + HOSTED_PAUSE_MS
        await this.speakWithBrowser(chunks.slice(i).join(' '), abort.signal)
        return 'browser'
      }
      if (abort.signal.aborted) return 'voice'
      for (let ahead = 1; ahead <= PREFETCH; ahead++) fetchChunk(i + ahead)
      await this.play(clip, abort.signal)
    }
    return 'voice'
  }

  /** Plays a recorded phrase. Resolves false if there is no recording for this voice, so the caller can generate it instead. */
  private playClip(voice: string, name: ClipName, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      const finish = (played: boolean) => {
        this.audio.onended = null
        this.audio.onerror = null
        signal.removeEventListener('abort', onAbort)
        resolve(played)
      }
      const onAbort = () => finish(true)
      this.audio.onended = () => finish(true)
      this.audio.onerror = () => finish(false)
      signal.addEventListener('abort', onAbort)
      this.audio.src = clipUrl(voice, name)
      this.audio.play().catch(() => finish(false))
    })
  }

  private play(clip: Blob, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(clip)
      const finish = () => {
        this.audio.onended = null
        this.audio.onerror = null
        signal.removeEventListener('abort', finish)
        URL.revokeObjectURL(url)
        resolve()
      }
      this.audio.onended = finish
      this.audio.onerror = finish
      signal.addEventListener('abort', finish)
      this.audio.src = url
      this.audio.play().catch(finish)
    })
  }

  private speakWithBrowser(text: string, signal: AbortSignal, language?: string): Promise<void> {
    if (!('speechSynthesis' in window)) return Promise.resolve()
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      // Some browsers never fire the end event (no voices installed); don't let that freeze the conversation.
      const watchdog = window.setTimeout(() => finish(), BROWSER_SPEECH_BASE_MS + text.length * BROWSER_SPEECH_MS_PER_CHAR)
      utterance.voice = pickBrowserVoice(language) ?? null
      if (language) utterance.lang = language
      utterance.rate = 1.02
      const finish = () => {
        window.clearTimeout(watchdog)
        signal.removeEventListener('abort', finish)
        resolve()
      }
      utterance.onend = finish
      utterance.onerror = finish
      signal.addEventListener('abort', finish)
      speechSynthesis.speak(utterance)
    })
  }
}
