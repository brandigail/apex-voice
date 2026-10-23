import { useContext } from 'react'
import { PasscodeContext, type PasscodeContextValue } from './passcode-context'

export function usePasscode(): PasscodeContextValue {
  const ctx = useContext(PasscodeContext)
  if (!ctx) throw new Error('usePasscode must be used within PasscodeProvider')
  return ctx
}
