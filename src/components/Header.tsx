import { AudioWaveform, LogOut, Moon, Sun } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import { useTheme } from '../providers/useTheme'

const iconButton = 'inline-flex size-10 items-center justify-center rounded-full hover:bg-violet-500/15'

export function Header({ signedIn }: { signedIn: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <header className="sticky top-0 z-20 border-b border-(--line) bg-(--page)/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/40">
            <AudioWaveform className="size-5" aria-hidden="true" />
          </span>
          <span>
            Apex <span className="text-gradient">Voice</span>
          </span>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className={iconButton}
          >
            {isDark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
          </button>
          {signedIn && (
            <button type="button" onClick={() => void authClient.signOut()} aria-label="Sign out" className={iconButton}>
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
