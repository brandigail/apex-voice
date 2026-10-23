import { Loader2, Mic, Square } from 'lucide-react'

export type RecordButtonMode = 'idle' | 'recording' | 'busy'

interface RecordButtonProps {
  mode: RecordButtonMode
  onStart: () => void
  onStop: () => void
}

export function RecordButton({ mode, onStart, onStop }: RecordButtonProps) {
  const recording = mode === 'recording'
  const busy = mode === 'busy'

  return (
    <div className="relative flex size-28 items-center justify-center">
      {recording && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-red-500/30 motion-safe:animate-ping"
        />
      )}
      <button
        type="button"
        onClick={recording ? onStop : onStart}
        disabled={busy}
        aria-label={recording ? 'Stop recording' : busy ? 'Working' : 'Start recording'}
        className={`relative flex size-24 items-center justify-center rounded-full text-white shadow-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          recording ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {recording ? (
          <Square className="size-9" fill="currentColor" aria-hidden="true" />
        ) : busy ? (
          <Loader2 className="size-9 motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="size-10" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
