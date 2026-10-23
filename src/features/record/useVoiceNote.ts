import { useCallback, useRef, useState } from 'react'
import { ApiRequestError, generateDraft, transcribeAudio } from '../../lib/api'
import { usePasscode } from '../../providers/usePasscode'
import type { GeneratedDraft } from '../../types/draft'
import type { RecordedAudio } from './useAudioRecorder'

export type VoiceNoteStage = 'idle' | 'transcribing' | 'structuring' | 'done' | 'error'

export interface VoiceNoteResult {
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

export function useVoiceNote(): UseVoiceNote {
  const { passcode, reject } = usePasscode()
  const [stage, setStage] = useState<VoiceNoteStage>('idle')
  const [result, setResult] = useState<VoiceNoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recordingRef = useRef<RecordedAudio | null>(null)
  const transcriptRef = useRef<string | null>(null)
  /** Incremented on every run and reset so a superseded run can't overwrite newer state. */
  const runIdRef = useRef(0)

  const run = useCallback(
    async (recording: RecordedAudio) => {
      if (!passcode) return
      const runId = ++runIdRef.current
      const isCurrent = () => runId === runIdRef.current

      recordingRef.current = recording
      setError(null)
      setResult(null)

      try {
        let transcript = transcriptRef.current
        if (transcript === null) {
          setStage('transcribing')
          transcript = await transcribeAudio(recording.blob, recording.mimeType, passcode)
          if (!isCurrent()) return
          transcriptRef.current = transcript
        }

        setStage('structuring')
        const draft = await generateDraft(transcript, passcode)
        if (!isCurrent()) return

        setResult({ transcript, draft })
        setStage('done')
      } catch (err) {
        if (!isCurrent()) return
        if (err instanceof ApiRequestError && err.status === 401) reject()
        setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.')
        setStage('error')
      }
    },
    [passcode, reject],
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
