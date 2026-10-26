import { fetchSpeech } from '../../lib/assistant-api'
import { MAX_SPEECH_CHARS } from '../../types/assistant'
import { readStoredVoice } from './voice'

/** Keep each request a little under the model's limit so a trailing space or quote never tips it over. */
const CHUNK_CHARS = MAX_SPEECH_CHARS - 12
/** Chunks fetched ahead of the one being played, so a long answer flows without gaps. */
const PREFETCH = 2
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
export function splitForSpeech(text: string, max = CHUNK_CHARS): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []
  const pieces: string[] = []
  for (const raw of sentences) {
    let rest = raw.trim()
    while (rest.length > max) {
      const window = rest.slice(0, max)
      const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' '))
      const at = cut > max / 3 ? cut + 1 : max
      pieces.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) pieces.push(rest)
  }

  // Join short neighbours so the voice gets natural phrases, not one request per tiny sentence.
  const chunks: string[] = []
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1]
    if (last !== undefined && last.length + 1 + piece.length <= max) chunks[chunks.length - 1] = `${last} ${piece}`
    else chunks.push(piece)
  }
  return chunks
}

/** The most natural-sounding voice the browser has, used only when the hosted voice is unavailable. */
function pickBrowserVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  const preferred = [/natural/i, /online/i, /google/i, /samantha|ava|serena|karen/i]
  for (const pattern of preferred) {
    const match = voices.find((voice) => pattern.test(voice.name))
    if (match) return match
  }
  return voices[0]
}

export type SpeechEngine = 'voice' | 'browser'

/** Speaks replies out loud: the hosted voice first, the browser's own voice if that fails. */
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

  /** Resolves when the whole reply has been spoken, or as soon as {@link stop} is called. */
  async speak(text: string): Promise<SpeechEngine> {
    this.stop()
    const abort = new AbortController()
    this.abort = abort
    const chunks = splitForSpeech(forSpeech(text))
    const voice = readStoredVoice()
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
      } catch {
        if (abort.signal.aborted) return 'voice'
        await this.speakWithBrowser(chunks.slice(i).join(' '), abort.signal)
        return 'browser'
      }
      if (abort.signal.aborted) return 'voice'
      for (let ahead = 1; ahead <= PREFETCH; ahead++) fetchChunk(i + ahead)
      await this.play(clip, abort.signal)
    }
    return 'voice'
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

  private speakWithBrowser(text: string, signal: AbortSignal): Promise<void> {
    if (!('speechSynthesis' in window)) return Promise.resolve()
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      // Some browsers never fire the end event (no voices installed); don't let that freeze the conversation.
      const watchdog = window.setTimeout(() => finish(), BROWSER_SPEECH_BASE_MS + text.length * BROWSER_SPEECH_MS_PER_CHAR)
      utterance.voice = pickBrowserVoice() ?? null
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
