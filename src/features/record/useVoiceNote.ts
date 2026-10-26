import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiRequestError, generateDraft, transcribeRecording } from '../../lib/api'
import { authClient } from '../../lib/auth-client'
import type { DraftCategory, GeneratedDraft } from '../../types/draft'
import { readSpokenLanguage, readWriteLanguage } from '../language/languageSettings'
import type { RecordedAudio } from './useAudioRecorder'

export type VoiceNoteStage = 'idle' | 'transcribing' | 'structuring' | 'done' | 'error'

export interface VoiceNoteResult {
  /** Generated on the client so the draft can be saved (and later queued offline) under a stable id. */
  id: string
  createdAt: string
  transcript: string
  draft: GeneratedDraft
}

export interface UseVoiceNote {
  stage: VoiceNoteStage
  result: VoiceNoteResult | null
  error: string | null
  /** Transcribe and structure a clip. */
  run: (recording: RecordedAudio) => Promise<void>
  /** Re-run the failed step for the last clip, reusing the transcript if transcription already succeeded. */
  retry: () => Promise<void>
  /** Apply the user's edits to the current draft. */
  updateDraft: (patch: Partial<GeneratedDraft>) => void
  reset: () => void
}

/** `category` is the channel the user picked; the latest value is read when a recording finishes. */
export function useVoiceNote(category: DraftCategory): UseVoiceNote {
  const [stage, setStage] = useState<VoiceNoteStage>('idle')
  const [result, setResult] = useState<VoiceNoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const categoryRef = useRef(category)
  useEffect(() => {
    categoryRef.current = category
  }, [category])

  const recordingRef = useRef<RecordedAudio | null>(null)
  const transcriptRef = useRef<string | null>(null)
  /** Incremented on every run and reset so a superseded run can't overwrite newer state. */
  const runIdRef = useRef(0)

  const run = useCallback(
    async (recording: RecordedAudio) => {
      const runId = ++runIdRef.current
      const isCurrent = () => runId === runIdRef.current

      recordingRef.current = recording
      setError(null)
      setResult(null)

      try {
        let transcript = transcriptRef.current
        if (transcript === null) {
          setStage('transcribing')
          transcript = await transcribeRecording(recording.segments, recording.mimeType, readSpokenLanguage())
          if (!transcript) throw new ApiRequestError(422, 'No speech detected. Try recording again.')
          if (!isCurrent()) return
          transcriptRef.current = transcript
        }

        setStage('structuring')
        const draft = await generateDraft(transcript, categoryRef.current, readWriteLanguage(), readSpokenLanguage())
        if (!isCurrent()) return

        setResult({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), transcript, draft })
        setStage('done')
      } catch (err) {
        if (!isCurrent()) return
        // An expired session: signing out returns the user to the sign-in screen.
        if (err instanceof ApiRequestError && err.status === 401) void authClient.signOut()
        setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.')
        setStage('error')
      }
    },
    [],
  )

  const retry = useCallback(async () => {
    if (recordingRef.current) await run(recordingRef.current)
  }, [run])

  const updateDraft = useCallback((patch: Partial<GeneratedDraft>) => {
    setResult((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current))
  }, [])

  const reset = useCallback(() => {
    runIdRef.current++
    recordingRef.current = null
    transcriptRef.current = null
    setStage('idle')
    setResult(null)
    setError(null)
  }, [])

  return { stage, result, error, run, retry, updateDraft, reset }
}
