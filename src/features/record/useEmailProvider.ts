import { useCallback, useState } from 'react'
import { EMAIL_PROVIDERS, type EmailProvider } from '../../lib/share'

const STORAGE_KEY = 'apex-voice-email-provider'

function readStored(): EmailProvider {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return EMAIL_PROVIDERS.find((p) => p.id === stored)?.id ?? 'default'
  } catch {
    return 'default'
  }
}

/** The mail app the user prefers, remembered on this device. */
export function useEmailProvider(): [EmailProvider, (provider: EmailProvider) => void] {
  const [provider, setProvider] = useState<EmailProvider>(readStored)

  const choose = useCallback((next: EmailProvider) => {
    setProvider(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable; the choice lasts for this session only
    }
  }, [])

  return [provider, choose]
}
