import type { ReactNode } from 'react'
import { PasscodeProvider } from './PasscodeProvider'
import { ThemeProvider } from './ThemeProvider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PasscodeProvider>{children}</PasscodeProvider>
    </ThemeProvider>
  )
}
