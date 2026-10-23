import { AudioWaveform, Moon, Sun } from 'lucide-react'
import { useTheme } from '../providers/useTheme'

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2 font-semibold">
          <AudioWaveform className="size-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          Apex Voice
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800"
        >
          {isDark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
        </button>
      </div>
    </header>
  )
}
