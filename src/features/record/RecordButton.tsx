import type { CSSProperties } from 'react'
import { Loader2, Mic } from 'lucide-react'
import type { Channel } from '../../lib/channels'

export type RecordButtonMode = 'idle' | 'recording' | 'busy'

interface RecordButtonProps {
  mode: RecordButtonMode
  channel: Channel
  onStart: () => void
  onStop: () => void
}

const BAR_COUNT = 5

/** The hero control: a glowing orb in the colours of the chosen channel, with live waveform bars while recording. */
export function RecordButton({ mode, channel, onStart, onStop }: RecordButtonProps) {
  const recording = mode === 'recording'
  const busy = mode === 'busy'

  return (
    <div
      className="relative flex size-48 items-center justify-center"
      style={{ '--c1': channel.from, '--c2': channel.to } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="absolute inset-4 rounded-full bg-linear-to-br from-(--c1) to-(--c2) opacity-40 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="absolute inset-2 rounded-full border border-dashed border-(--c1)/50 motion-safe:animate-orb-spin"
      />
      {recording &&
        [0, 0.8, 1.6].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            style={{ animationDelay: `${delay}s` }}
            className="absolute inset-6 rounded-full border-2 border-(--c1) motion-safe:animate-orb-pulse"
          />
        ))}
      <button
        type="button"
        onClick={recording ? onStop : onStart}
        disabled={busy}
        aria-label={recording ? 'Stop recording' : busy ? 'Working' : 'Start recording'}
        className="relative flex size-32 items-center justify-center rounded-full bg-linear-to-br from-(--c1) to-(--c2) text-white shadow-[0_20px_50px_-12px_var(--c1),inset_0_2px_0_rgb(255_255_255/0.35),inset_0_-8px_20px_rgb(0_0_0/0.18)] hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
      >
        {recording ? (
          <span className="flex h-12 items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 0.12}s` }}
                className="h-full w-1.5 origin-center rounded-full bg-white motion-safe:animate-bar"
              />
            ))}
          </span>
        ) : busy ? (
          <Loader2 className="size-12 motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="size-12" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
