import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { PasscodeContext } from './passcode-context'

const STORAGE_KEY = 'apex-voice-passcode'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // storage unavailable; the passcode lasts for this session only
  }
}

export function PasscodeProvider({ children }: { children: ReactNode }) {
  const [passcode, setPasscode] = useState<string | null>(readStored)
  const [rejected, setRejected] = useState(false)

  const save = useCallback((value: string) => {
    writeStored(value)
    setPasscode(value)
    setRejected(false)
  }, [])

  const reject = useCallback(() => {
    writeStored(null)
    setPasscode(null)
    setRejected(true)
  }, [])

  const value = useMemo(() => ({ passcode, rejected, save, reject }), [passcode, rejected, save, reject])

  return <PasscodeContext.Provider value={value}>{children}</PasscodeContext.Provider>
}
