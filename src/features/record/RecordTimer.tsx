import { formatDuration } from '../../lib/format'
import { MAX_RECORDING_SECONDS } from './useAudioRecorder'

interface RecordTimerProps {
  elapsedMs: number
}

export function RecordTimer({ elapsedMs }: RecordTimerProps) {
  const maxMs = MAX_RECORDING_SECONDS * 1000
  const percent = Math.min(100, (elapsedMs / maxMs) * 100)
  const nearLimit = elapsedMs >= maxMs - 10_000

  return (
    <div className="w-full max-w-xs">
      <p className="text-center font-mono text-3xl tabular-nums">
        {formatDuration(elapsedMs)}
        <span className="text-base text-slate-500 dark:text-slate-400"> / {formatDuration(maxMs)}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Recording length"
        aria-valuemin={0}
        aria-valuemax={MAX_RECORDING_SECONDS}
        aria-valuenow={Math.floor(elapsedMs / 1000)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={`h-full transition-[width] ${nearLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
