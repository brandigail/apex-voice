import { AlertCircle, RotateCcw, Sparkles } from 'lucide-react'
import { ChannelIcon } from '../../components/ChannelIcon'
import { channelFor } from '../../lib/channels'
import { SpokenLanguageSelect, WriteLanguageSelect } from '../language/LanguageSelect'
import { ChannelPicker } from './ChannelPicker'
import { DraftCard } from './DraftCard'
import { RecordButton, type RecordButtonMode } from './RecordButton'
import { RecordTimer } from './RecordTimer'
import { MAX_RECORDING_SECONDS, useAudioRecorder } from './useAudioRecorder'
import { useChannel } from './useChannel'
import { useDraftAutosave } from './useDraftAutosave'
import { useVoiceNote, type VoiceNoteStage } from './useVoiceNote'

const STAGE_LABEL: Partial<Record<VoiceNoteStage, string>> = {
  transcribing: 'Listening to your note…',
  structuring: 'Writing your draft…',
}

export function RecordView() {
  const [category, setCategory] = useChannel()
  const note = useVoiceNote(category)
  const recorder = useAudioRecorder(note.run)
  const saveStatus = useDraftAutosave(note.result)
  const channel = channelFor(category)

  const processing = note.stage === 'transcribing' || note.stage === 'structuring'
  const recording = recorder.status === 'recording'
  const requesting = recorder.status === 'requesting'
  const choosing = !recording && !requesting && !processing && !note.result

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
      <div className="animate-rise">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--surface) px-3 py-1 text-xs font-semibold backdrop-blur">
          <Sparkles className="size-3.5 text-fuchsia-400" aria-hidden="true" />
          Voice in, finished message out
        </p>
        <h1 id="record-heading" className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
          Say it once.
          <br />
          <span className="text-gradient">Send it anywhere.</span>
        </h1>
      </div>

      {choosing ? (
        <div className="animate-rise w-full" style={{ animationDelay: '80ms' }}>
          <ChannelPicker value={category} onChange={setCategory} />
        </div>
      ) : (
        !note.result && (
          <p className="surface inline-flex items-center gap-2 rounded-full! px-4 py-2 text-sm font-semibold">
            <ChannelIcon category={category} className="size-4" />
            Recording for {channel.label}
          </p>
        )
      )}

      {!note.result && (
        <>
          <RecordButton mode={mode} channel={channel} onStart={handleStart} onStop={recorder.stop} />

          {recording ? (
            <RecordTimer elapsedMs={recorder.elapsedMs} />
          ) : (
            !processing && (
              <p className="muted -mt-2 text-sm">
                {requesting
                  ? 'Allow microphone access to begin.'
                  : `Tap to record for ${channel.label}. Up to ${MAX_RECORDING_SECONDS / 60} minutes.`}
              </p>
            )
          )}

          {choosing && (
            <div className="surface flex w-full flex-col gap-3 p-4 sm:flex-row" data-tour="languages">
              <SpokenLanguageSelect id="record-spoken-language" />
              <WriteLanguageSelect id="record-write-language" />
            </div>
          )}
        </>
      )}

      <p role="status" aria-live="polite" className={stageLabel ? 'text-lg font-semibold' : 'sr-only'}>
        {status}
      </p>

      {error && (
        <div
          role="alert"
          className="flex w-full items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-left text-sm text-red-700 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p>{error}</p>
            {note.stage === 'error' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void note.retry()} className="btn btn-ghost">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Try again
                </button>
                <button type="button" onClick={startNew} className="btn btn-ghost">
                  Record again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {note.result && (
        <>
          <DraftCard result={note.result} onChange={note.updateDraft} saveStatus={saveStatus} />
          <button type="button" onClick={startNew} className="btn btn-ghost">
            <RotateCcw className="size-4" aria-hidden="true" />
            New recording
          </button>
        </>
      )}
    </section>
  )
}
