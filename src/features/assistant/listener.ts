import { pickMimeType, toRecorderError } from '../record/recorder-utils'

/** How long the user must stay quiet before we decide they have finished. Long on purpose: people pause to think. */
export const SILENCE_MS = 2_200
/** Shorter blips of sound are coughs and clicks, not a request. */
const MIN_SPEECH_MS = 350
/** Listening to the room first lets the threshold sit above its background noise. */
const CALIBRATION_MS = 600
const MIN_THRESHOLD = 0.018
const NOISE_MULTIPLIER = 3.5
const TICK_MS = 50
/** Each saved piece stays well under the upload limit; a long speech simply becomes several pieces. */
const SEGMENT_MS = 45_000
/** Without speech, drop what was recorded now and then so a quiet room doesn't pile up audio. */
const IDLE_RESTART_MS = 15_000
/** End the session after this long with nobody speaking. */
const IDLE_TIMEOUT_MS = 3 * 60_000

export interface Utterance {
  segments: Blob[]
  mimeType: string
}

export interface ListenerEvents {
  /** Microphone loudness from 0 to about 1, many times a second; used to animate the orb. */
  onLevel: (level: number) => void
  /** Speech has started (true) or the room went quiet before the user said anything (false). */
  onHearing: (hearing: boolean) => void
  onUtterance: (utterance: Utterance) => void
  onIdleTimeout: () => void
  /** The microphone was taken away, for example when an iPhone locks its screen or a call comes in. */
  onInterrupted: () => void
  onError: (message: string) => void
}

/**
 * Keeps the microphone open for a whole conversation and cuts it into spoken turns. A turn ends after
 * {@link SILENCE_MS} of quiet, so the assistant never answers while the user is still talking.
 */
export class Listener {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private samples = new Uint8Array(0)
  private recorder: MediaRecorder | null = null
  private mimeType = ''
  private chunks: Blob[] = []
  private segments: Blob[] = []
  private timer: number | null = null
  private listening = false
  private rotating = false

  private turnStartedAt = 0
  private recorderStartedAt = 0
  private lastSpeechAt = 0
  private speechMs = 0
  private noiseSum = 0
  private noiseCount = 0
  private threshold = MIN_THRESHOLD
  private heard = false
  private idleSince = 0

  constructor(private readonly events: ListenerEvents) {}

  /** Opens the microphone. Must be called from a tap or click. */
  async start(): Promise<void> {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser cannot record audio. Try Chrome, Edge, Firefox or Safari.')
    }
    // Created before the permission prompt: iOS Safari only lets audio start from the tap itself, not after an await.
    const context = new AudioContext()
    void context.resume().catch(() => undefined)
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (err) {
      void context.close().catch(() => undefined)
      throw new Error(toRecorderError(err).message, { cause: err })
    }
    this.mimeType = pickMimeType() ?? ''
    this.context = context
    await context.resume().catch(() => undefined)
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 1024
    this.samples = new Uint8Array(this.analyser.fftSize)
    this.context.createMediaStreamSource(this.stream).connect(this.analyser)
  }

  /** Starts waiting for the next thing the user says. */
  listen(): void {
    if (!this.stream || this.listening) return
    this.listening = true
    this.segments = []
    this.heard = false
    this.speechMs = 0
    this.noiseSum = 0
    this.noiseCount = 0
    this.threshold = MIN_THRESHOLD
    this.turnStartedAt = performance.now()
    this.idleSince = this.turnStartedAt
    this.lastSpeechAt = 0
    this.startRecorder()
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  /** Stops listening without ending the session, e.g. while the assistant is thinking or speaking. */
  pause(): void {
    this.listening = false
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.discardRecorder()
    this.events.onLevel(0)
    this.events.onHearing(false)
  }

  /** The user tapped "I'm done": send what has been said so far without waiting for the silence. */
  finishNow(): void {
    if (this.listening && this.heard) void this.endTurn()
  }

  stop(): void {
    this.pause()
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    void this.context?.close().catch(() => undefined)
    this.context = null
    this.analyser = null
  }

  private level(): number {
    if (!this.analyser) return 0
    this.analyser.getByteTimeDomainData(this.samples)
    let sum = 0
    for (const value of this.samples) {
      const centred = (value - 128) / 128
      sum += centred * centred
    }
    return Math.sqrt(sum / this.samples.length)
  }

  private tick(): void {
    // Phones suspend audio when the screen turns off (iOS calls it "interrupted"); wake it again so listening carries on.
    const audioState: string = this.context?.state ?? 'closed'
    if (audioState === 'suspended' || audioState === 'interrupted') void this.context?.resume().catch(() => undefined)
    // If the microphone itself was taken away there is nothing left to listen to, so say so instead of hanging.
    if (this.stream?.getAudioTracks().every((track) => track.readyState === 'ended')) {
      this.pause()
      this.events.onInterrupted()
      return
    }
    const now = performance.now()
    const level = this.level()
    this.events.onLevel(Math.min(1, level * 6))

    if (now - this.turnStartedAt < CALIBRATION_MS) {
      this.noiseSum += level
      this.noiseCount++
      return
    }
    if (this.noiseCount > 0) {
      this.threshold = Math.max(MIN_THRESHOLD, (this.noiseSum / this.noiseCount) * NOISE_MULTIPLIER)
      this.noiseCount = 0
    }

    if (level > this.threshold) {
      this.speechMs += TICK_MS
      this.lastSpeechAt = now
      this.idleSince = now
      if (!this.heard && this.speechMs >= MIN_SPEECH_MS) {
        this.heard = true
        this.events.onHearing(true)
      }
    }

    if (this.heard) {
      if (now - this.lastSpeechAt >= SILENCE_MS) void this.endTurn()
      else if (now - this.recorderStartedAt >= SEGMENT_MS) void this.rotateRecorder()
      return
    }

    // Nothing meaningful heard yet: forget stray blips and keep the buffer small.
    if (now - this.lastSpeechAt > 1_000) this.speechMs = 0
    if (now - this.recorderStartedAt >= IDLE_RESTART_MS) this.restartRecorder()
    if (now - this.idleSince >= IDLE_TIMEOUT_MS) {
      this.pause()
      this.events.onIdleTimeout()
    }
  }

  private startRecorder(): void {
    if (!this.stream) return
    try {
      const recorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined)
      this.chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data)
      }
      recorder.onerror = () => this.events.onError(toRecorderError(null).message)
      recorder.start()
      this.recorder = recorder
      this.recorderStartedAt = performance.now()
    } catch (err) {
      this.events.onError(toRecorderError(err).message)
    }
  }

  /** Stops the recorder and hands back everything it captured as one complete, decodable clip. */
  private finishRecorder(): Promise<Blob | null> {
    const recorder = this.recorder
    this.recorder = null
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null)
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || this.mimeType || 'audio/webm' })
        this.chunks = []
        resolve(blob.size > 0 ? blob : null)
      }
      recorder.stop()
    })
  }

  private discardRecorder(): void {
    const recorder = this.recorder
    this.recorder = null
    if (!recorder) return
    recorder.ondataavailable = null
    recorder.onstop = null
    if (recorder.state !== 'inactive') recorder.stop()
    this.chunks = []
  }

  private restartRecorder(): void {
    this.discardRecorder()
    this.startRecorder()
  }

  private async rotateRecorder(): Promise<void> {
    if (this.rotating) return
    this.rotating = true
    try {
      const piece = await this.finishRecorder()
      if (piece) this.segments.push(piece)
      if (this.listening) this.startRecorder()
    } finally {
      this.rotating = false
    }
  }

  private async endTurn(): Promise<void> {
    const mimeType = this.mimeType || 'audio/webm'
    this.listening = false
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.events.onLevel(0)
    this.events.onHearing(false)
    const last = await this.finishRecorder()
    if (last) this.segments.push(last)
    const segments = this.segments
    this.segments = []
    if (segments.length > 0) this.events.onUtterance({ segments, mimeType })
    else this.events.onError('I could not hear anything. Please try again.')
  }
}

/** Keeps the screen awake during a conversation, because a sleeping phone stops the microphone. */
export class ScreenLock {
  private sentinel: WakeLockSentinel | null = null
  private active = false
  private readonly reacquire = () => {
    if (this.active && document.visibilityState === 'visible') void this.request()
  }

  async enable(): Promise<void> {
    this.active = true
    document.addEventListener('visibilitychange', this.reacquire)
    await this.request()
  }

  async disable(): Promise<void> {
    this.active = false
    document.removeEventListener('visibilitychange', this.reacquire)
    await this.sentinel?.release().catch(() => undefined)
    this.sentinel = null
  }

  private async request(): Promise<void> {
    try {
      this.sentinel = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      // not supported or refused (low battery); the conversation still works while the screen stays on
    }
  }
}
