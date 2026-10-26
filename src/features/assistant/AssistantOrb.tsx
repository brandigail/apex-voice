import type { CSSProperties } from 'react'
import { Loader2, Mic } from 'lucide-react'
import type { AssistantPhase } from './useAssistant'

interface AssistantOrbProps {
  phase: AssistantPhase
  onTap: () => void
  orbRef: React.RefObject<HTMLDivElement | null>
}

const LABEL: Record<AssistantPhase, string> = {
  idle: 'Start a conversation',
  starting: 'Starting',
  listening: 'Listening',
  hearing: 'Tap if you are done talking',
  thinking: 'Thinking',
  speaking: 'Tap to interrupt',
}

const BARS = [0.3, 0.6, 1, 0.7, 0.4]

/** The assistant's face: it breathes while listening, reacts to the voice, and dances while Apex speaks. */
export function AssistantOrb({ phase, onTap, orbRef }: AssistantOrbProps) {
  const active = phase !== 'idle'
  const working = phase === 'starting' || phase === 'thinking'
  const moving = phase === 'hearing' || phase === 'speaking'

  return (
    <div
      ref={orbRef}
      className="relative flex size-56 items-center justify-center"
      style={{ '--c1': '#6366f1', '--c2': '#d946ef', '--level': 0 } as CSSProperties}
    >
      <span aria-hidden="true" className="absolute inset-6 rounded-full bg-linear-to-br from-(--c1) via-(--c2) to-cyan-400 opacity-45 blur-3xl" />
      <span aria-hidden="true" className="absolute inset-2 rounded-full border border-dashed border-(--c1)/50 motion-safe:animate-orb-spin" />
      {(phase === 'listening' || phase === 'hearing') &&
        [0, 1.2].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            style={{ animationDelay: `${delay}s` }}
            className="absolute inset-9 rounded-full border-2 border-(--c1) motion-safe:animate-orb-pulse"
          />
        ))}
      <span
        aria-hidden="true"
        className="absolute inset-8 rounded-full border-2 border-(--c2)/70 transition-transform duration-75"
        style={{ transform: phase === 'hearing' ? 'scale(calc(1 + var(--level) * 0.28))' : 'scale(1)' }}
      />
      <button
        type="button"
        onClick={onTap}
        disabled={working}
        aria-label={LABEL[phase]}
        className="relative flex size-36 items-center justify-center rounded-full bg-linear-to-br from-(--c1) via-violet-500 to-(--c2) text-white shadow-[0_24px_60px_-14px_var(--c1),inset_0_2px_0_rgb(255_255_255/0.35),inset_0_-10px_24px_rgb(0_0_0/0.2)] hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {working ? (
          <Loader2 className="size-14 motion-safe:animate-spin" aria-hidden="true" />
        ) : moving ? (
          <span className="flex h-14 items-center gap-1.5" aria-hidden="true">
            {BARS.map((height, i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 0.12}s`, height: `${height * 100}%` }}
                className="w-1.5 origin-center rounded-full bg-white motion-safe:animate-bar"
              />
            ))}
          </span>
        ) : (
          <Mic className={`size-14 ${active ? 'motion-safe:animate-pulse' : ''}`} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
