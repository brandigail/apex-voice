import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EMPTY_ERROR,
  UNSUPPORTED_ERROR,
  pickMimeType,
  toRecorderError,
  type RecorderError,
} from './recorder-utils'

/** The longest single recording. */
export const MAX_RECORDING_SECONDS = 300
/**
 * A recording is saved as separate complete clips of at most this long, because pieces of one continuous recording
 * are not independently decodable and uploads must stay well under Netlify's 6 MB request limit.
 */
const SEGMENT_SECONDS = 45

const TICK_MS = 200

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded' | 'error'

export interface RecordedAudio {
  /** The recording in order, each piece a complete, decodable clip. */
  segments: Blob[]
  mimeType: string
  durationMs: number
}

export interface UseAudioRecorder {
  status: RecorderStatus
  /** Milliseconds recorded so far; updates while recording. */
  elapsedMs: number
  error: RecorderError | null
  /** The complete recording, available once status is `recorded`. */
  recording: RecordedAudio | null
  /** Must be called from a user gesture (tap or click); iOS Safari refuses otherwise. */
  start: () => Promise<void>
  stop: () => void
  reset: () => void
}

/** `onRecorded` fires once with the complete recording, whether the user stopped it or the time limit did. */
export function useAudioRecorder(onRecorded?: (recording: RecordedAudio) => void): UseAudioRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<RecorderError | null>(null)
  const [recording, setRecording] = useState<RecordedAudio | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const segmentsRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const segmentStartedAtRef = useRef(0)
  /** True while a segment is being closed so the next one can start straight away. */
  const rotatingRef = useRef(false)
  /** True from a start() call until the mic is acquired; cleared by teardown to cancel a pending start. */
  const startingRef = useRef(false)
  const onRecordedRef = useRef(onRecorded)
  const mimeTypeRef = useRef<string | undefined>(undefined)
  /** Starts the next segment; set after beginSegment exists so a segment can hand over to its successor. */
  const nextSegmentRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    onRecordedRef.current = onRecorded
  }, [onRecorded])

  /** Stops the timer, mic and recorder without firing any state updates. */
  const teardown = useCallback(() => {
    startingRef.current = false
    rotatingRef.current = false
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
    rotatingRef.current = false
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') recorder.stop()
  }, [])

  /** Starts a fresh MediaRecorder on the open stream; called for the first segment and after each rotation. */
  const beginSegment = useCallback(
    (stream: MediaStream, mimeType: string | undefined) => {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => fail(toRecorderError(null))
      recorder.onstop = () => {
        const clipType = recorder.mimeType || mimeType || 'audio/webm'
        const clip = new Blob(chunksRef.current, { type: clipType })
        chunksRef.current = []
        if (clip.size > 0) segmentsRef.current.push(clip)

        if (rotatingRef.current && streamRef.current) {
          rotatingRef.current = false
          nextSegmentRef.current()
          return
        }

        const durationMs = Math.min(performance.now() - startedAtRef.current, MAX_RECORDING_SECONDS * 1000)
        const segments = segmentsRef.current
        segmentsRef.current = []
        teardown()
        if (segments.length === 0) {
          fail(EMPTY_ERROR)
          return
        }
        setElapsedMs(durationMs)
        const recorded: RecordedAudio = { segments, mimeType: clipType, durationMs }
        setRecording(recorded)
        setStatus('recorded')
        onRecordedRef.current?.(recorded)
      }
      recorder.start()
      recorderRef.current = recorder
      segmentStartedAtRef.current = performance.now()
    },
    [fail, teardown],
  )

  useEffect(() => {
    nextSegmentRef.current = () => {
      if (!streamRef.current) return
      try {
        beginSegment(streamRef.current, mimeTypeRef.current)
      } catch (err) {
        fail(toRecorderError(err))
      }
    }
  }, [beginSegment, fail])

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

    streamRef.current = stream
    startingRef.current = false
    segmentsRef.current = []
    mimeTypeRef.current = pickMimeType()
    try {
      beginSegment(stream, mimeTypeRef.current)
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      fail(toRecorderError(err))
      return
    }

    startedAtRef.current = performance.now()
    setStatus('recording')

    timerRef.current = window.setInterval(() => {
      const now = performance.now()
      const elapsed = now - startedAtRef.current
      setElapsedMs(Math.min(elapsed, MAX_RECORDING_SECONDS * 1000))
      if (elapsed >= MAX_RECORDING_SECONDS * 1000) {
        stop()
        return
      }
      const recorder = recorderRef.current
      if (recorder?.state === 'recording' && !rotatingRef.current && now - segmentStartedAtRef.current >= SEGMENT_SECONDS * 1000) {
        rotatingRef.current = true
        recorder.stop()
      }
    }, TICK_MS)
  }, [beginSegment, fail, stop])

  const reset = useCallback(() => {
    teardown()
    segmentsRef.current = []
    setError(null)
    setRecording(null)
    setElapsedMs(0)
    setStatus('idle')
  }, [teardown])

  return { status, elapsedMs, error, recording, start, stop, reset }
}
