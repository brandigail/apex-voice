import { History, Mic, UserRound } from 'lucide-react'

export type Tab = 'record' | 'history' | 'profile'

const TABS = [
  { id: 'record', label: 'Record', icon: Mic },
  { id: 'history', label: 'History', icon: History },
  { id: 'profile', label: 'Profile', icon: UserRound },
] as const

interface TabBarProps {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
