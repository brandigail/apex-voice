import { CalendarDays, History, Mic, Sparkles, UserRound } from 'lucide-react'

export type Tab = 'record' | 'assistant' | 'agenda' | 'history' | 'profile'

const TABS = [
  { id: 'record', label: 'Record', icon: Mic },
  { id: 'assistant', label: 'Assistant', icon: Sparkles },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'history', label: 'History', icon: History },
  { id: 'profile', label: 'Profile', icon: UserRound },
] as const

interface TabBarProps {
  active: Tab
  onChange: (tab: Tab) => void
}

/** A floating glass dock rather than a full-width bar, so the aurora shows around it. */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <ul className="surface mx-auto flex max-w-md gap-1 rounded-full! p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active
          return (
            <li key={id} className={isActive ? 'flex-[2]' : 'flex-1'}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold ${
                  isActive
                    ? 'bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/40'
                    : 'muted hover:bg-violet-500/15 hover:text-(--ink)'
                }`}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {isActive && label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
