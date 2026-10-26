import { useCallback, useState } from 'react'
import { CHANNELS } from '../../lib/channels'
import type { DraftCategory } from '../../types/draft'

const STORAGE_KEY = 'apex-voice-channel'

function readStored(): DraftCategory {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return CHANNELS.find((c) => c.id === stored)?.id ?? 'EMAIL'
  } catch {
    return 'EMAIL'
  }
}

/** The channel the user last recorded for, remembered on this device. */
export function useChannel(): [DraftCategory, (channel: DraftCategory) => void] {
  const [channel, setChannel] = useState<DraftCategory>(readStored)

  const choose = useCallback((next: DraftCategory) => {
    setChannel(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable; the choice lasts for this session only
    }
  }, [])

  return [channel, choose]
}
