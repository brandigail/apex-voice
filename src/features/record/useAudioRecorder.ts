import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EMPTY_ERROR,
  UNSUPPORTED_ERROR,
  pickMimeType,
  toRecorderError,
  type RecorderError,
} from './recorder-utils'

/** Clips are capped so the base64 body stays under Netlify's 6 MB request limit. */
export const MAX_RECORDING_SECONDS = 60

const TICK_MS = 200

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded' | 'error'

export interface RecordedAudio {
  blob: Blob
  mimeType: string
  durationMs: number
}

export interface UseAudioRecorder {
  status: RecorderStatus
  /** Milliseconds recorded so far; updates while recording. */
  elapsedMs: number
  error: RecorderError | null
  /** The complete clip, available once status is `recorded`. */
  recording: RecordedAudio | null
  /** Must be called from a user gesture (tap or click); iOS Safari refuses otherwise. */
  start: () => Promise<void>
  stop: () => void
  reset: () => void
}

export function useAudioRecorder(): UseAudioRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<RecorderError | null>(null)
  const [recording, setRecording] = useState<RecordedAudio | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  /** True from a start() call until the mic is acquired; cleared by teardown to cancel a pending start. */
  const startingRef = useRef(false)

  /** Stops the timer, mic and recorder without firing any state updates. */
  const teardown = useCallback(() => {
    startingRef.current = false
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') recorder.stop()
      recorderRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => teardown, [teardown])

  const fail = useCallback(
    (err: RecorderError) => {
      teardown()
      setError(err)
      setStatus('error')
    },
    [teardown],
  )

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') recorder.stop()
  }, [])

  const start = useCallback(async () => {
    if (recorderRef.current || startingRef.current) return
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      fail(UNSUPPORTED_ERROR)
      return
    }

    startingRef.current = true
    setError(null)
    setRecording(null)
    setElapsedMs(0)
    setStatus('requesting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      if (startingRef.current) fail(toRecorderError(err))
      return
    }

    // reset() or unmount happened while the permission prompt was open.
    if (!startingRef.current) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    let recorder: MediaRecorder
    try {
      const mimeType = pickMimeType()
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop())
      fail(toRecorderError(err))
      return
    }

    streamRef.current = stream
    recorderRef.current = recorder
    startingRef.current = false
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onerror = () => fail(toRecorderError(null))
    recorder.onstop = () => {
      const durationMs = Math.min(performance.now() - startedAtRef.current, MAX_RECORDING_SECONDS * 1000)
      const mimeType = recorder.mimeType || 'audio/webm'
      // Timeslice chunks are not independently decodable, so the clip is only usable as one whole blob.
      const blob = new Blob(chunksRef.current, { type: mimeType })
      teardown()
      if (blob.size === 0) {
        fail(EMPTY_ERROR)
        return
      }
      setElapsedMs(durationMs)
      setRecording({ blob, mimeType, durationMs })
      setStatus('recorded')
    }

    startedAtRef.current = performance.now()
    recorder.start()
    setStatus('recording')

    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current
      setElapsedMs(Math.min(elapsed, MAX_RECORDING_SECONDS * 1000))
      if (elapsed >= MAX_RECORDING_SECONDS * 1000) stop()
    }, TICK_MS)
  }, [fail, stop, teardown])

  const reset = useCallback(() => {
    teardown()
    setError(null)
    setRecording(null)
    setElapsedMs(0)
    setStatus('idle')
  }, [teardown])

  return { status, elapsedMs, error, recording, start, stop, reset }
}
