import { AlertCircle, CalendarPlus, CheckCheck, FilePenLine, Sparkles, Square, Trash2 } from 'lucide-react'
import type { Tab } from '../../components/TabBar'
import type { AssistantAction } from '../../types/assistant'
import { AssistantOrb } from './AssistantOrb'
import { VoicePicker } from './VoicePicker'
import { useAssistant, type AssistantPhase } from './useAssistant'

const STATUS: Record<AssistantPhase, string> = {
  idle: 'Tap the orb and just talk. I will wait until you are finished.',
  starting: 'Getting ready…',
  listening: 'Listening…',
  hearing: 'I am hearing you. Take your time.',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

const SUGGESTIONS = [
  'What is on my agenda today?',
  'Do I have anything on Thursday?',
  'Did I already send Mr Smith his quote?',
  'Write a quote for Mrs Jones for a tiled floor.',
  'Add a meeting with the supplier tomorrow at ten.',
]

interface AssistantViewProps {
  firstName: string
  onNavigate: (tab: Tab) => void
}

function ActionChip({ action, onNavigate }: { action: AssistantAction; onNavigate: (tab: Tab) => void }) {
  const config =
    action.type === 'draft_created'
      ? { icon: FilePenLine, text: `Draft saved: ${action.label}`, tab: 'history' as const }
      : action.type === 'agenda_added'
        ? { icon: CalendarPlus, text: `Added: ${action.label}`, tab: 'agenda' as const }
        : { icon: CheckCheck, text: `Marked sent: ${action.label}`, tab: 'history' as const }
  const Icon = config.icon
  return (
    <button
      type="button"
      onClick={() => onNavigate(config.tab)}
      className="mt-2 inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--surface) px-3 py-1.5 text-xs font-semibold hover:border-violet-400/70"
    >
      <Icon className="size-3.5 text-violet-400" aria-hidden="true" />
      {config.text}
    </button>
  )
}

export function AssistantView({ firstName, onNavigate }: AssistantViewProps) {
  const { phase, lines, error, orbRef, tapOrb, end, clear } = useAssistant(firstName)
  const active = phase !== 'idle'

  return (
    <section aria-labelledby="assistant-heading" className="flex flex-col items-center gap-5 text-center">
      <div className="animate-rise">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--surface) px-3 py-1 text-xs font-semibold backdrop-blur">
          <Sparkles className="size-3.5 text-fuchsia-400" aria-hidden="true" />
          Hands-free assistant
        </p>
        <h1 id="assistant-heading" className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
          Just talk.
          <br />
          <span className="text-gradient">Apex handles it.</span>
        </h1>
      </div>

      <AssistantOrb phase={phase} onTap={tapOrb} orbRef={orbRef} />

      <p role="status" aria-live="polite" className="muted -mt-2 min-h-6 max-w-sm text-sm">
        {STATUS[phase]}
      </p>

      {!active && <VoicePicker />}

      {active ? (
        <button type="button" onClick={end} className="btn btn-ghost">
          <Square className="size-4" fill="currentColor" aria-hidden="true" />
          End conversation
        </button>
      ) : (
        lines.length === 0 && (
          <ul className="surface w-full max-w-md space-y-2 p-4 text-left text-sm">
            <li className="muted text-xs font-semibold tracking-wide uppercase">Try saying</li>
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>“{suggestion}”</li>
            ))}
          </ul>
        )
      )}

      {error && (
        <div
          role="alert"
          className="flex w-full items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-left text-sm text-red-700 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {lines.length > 0 && (
        <div className="flex w-full flex-col gap-3 text-left" aria-label="Conversation">
          {lines.map((line) => (
            <div key={line.id} className={`flex flex-col ${line.role === 'user' ? 'items-end' : 'items-start'}`}>
              <p
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap ${
                  line.role === 'user'
                    ? 'bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25'
                    : 'surface rounded-2xl!'
                }`}
              >
                {line.text}
              </p>
              {line.actions.map((action) => (
                <ActionChip key={action.id} action={action} onNavigate={onNavigate} />
              ))}
            </div>
          ))}
          {!active && (
            <button type="button" onClick={clear} className="btn btn-ghost mx-auto">
              <Trash2 className="size-4" aria-hidden="true" />
              Clear conversation
            </button>
          )}
        </div>
      )}
    </section>
  )
}
