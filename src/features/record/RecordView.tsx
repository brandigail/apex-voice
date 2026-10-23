import { AlertCircle, RotateCcw } from 'lucide-react'
import { DraftPreview } from './DraftPreview'
import { RecordButton, type RecordButtonMode } from './RecordButton'
import { RecordTimer } from './RecordTimer'
import { MAX_RECORDING_SECONDS, useAudioRecorder } from './useAudioRecorder'
import { useVoiceNote, type VoiceNoteStage } from './useVoiceNote'

const STAGE_LABEL: Partial<Record<VoiceNoteStage, string>> = {
  transcribing: 'Transcribing your note…',
  structuring: 'Writing your draft…',
}

const secondaryButton =
  'inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800'

export function RecordView() {
  const note = useVoiceNote()
  const recorder = useAudioRecorder(note.run)

  const processing = note.stage === 'transcribing' || note.stage === 'structuring'
  const recording = recorder.status === 'recording'
  const requesting = recorder.status === 'requesting'

  const mode: RecordButtonMode = recording ? 'recording' : requesting || processing ? 'busy' : 'idle'
  const error = recorder.error?.message ?? note.error
  const stageLabel = STAGE_LABEL[note.stage]

  const startNew = () => {
    note.reset()
    recorder.reset()
  }

  const handleStart = () => {
    note.reset()
    void recorder.start()
  }

  const status = recording
    ? 'Recording'
    : requesting
      ? 'Waiting for microphone permission'
      : (stageLabel ?? (note.stage === 'done' ? 'Draft ready' : ''))

  return (
    <section aria-labelledby="record-heading" className="flex flex-col items-center gap-6 text-center">
      <div>
        <h1 id="record-heading" className="text-2xl font-bold">
          Record a voice note
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Speak naturally. We will turn it into a ready-to-send draft.
        </p>
      </div>

      <RecordButton mode={mode} onStart={handleStart} onStop={recorder.stop} />

      {recording ? (
        <RecordTimer elapsedMs={recorder.elapsedMs} />
      ) : (
        !processing &&
        note.stage !== 'done' && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {requesting ? 'Allow microphone access to begin.' : `Tap to record. Up to ${MAX_RECORDING_SECONDS} seconds.`}
          </p>
        )
      )}

      <p role="status" aria-live="polite" className={stageLabel ? 'text-slate-700 dark:text-slate-300' : 'sr-only'}>
        {status}
      </p>

      {error && (
        <div
          role="alert"
          className="flex w-full items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-left text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p>{error}</p>
            {note.stage === 'error' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void note.retry()} className={secondaryButton}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Try again
                </button>
                <button type="button" onClick={startNew} className={secondaryButton}>
                  Record again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {note.result && (
        <>
          <DraftPreview result={note.result} />
          <button type="button" onClick={startNew} className={secondaryButton}>
            <RotateCcw className="size-4" aria-hidden="true" />
            New recording
          </button>
        </>
      )}
    </section>
  )
}
