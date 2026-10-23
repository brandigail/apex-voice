import { createContext } from 'react'

export interface PasscodeContextValue {
  /** The shared passcode, or null until the user has entered one. */
  passcode: string | null
  /** True when the server rejected the stored passcode. Cleared by the next save. */
  rejected: boolean
  save: (passcode: string) => void
  /** Call when the server answers 401: forgets the passcode so the gate reappears. */
  reject: () => void
}

export const PasscodeContext = createContext<PasscodeContextValue | null>(null)
