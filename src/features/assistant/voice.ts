import { ASSISTANT_VOICES, type AssistantVoice } from '../../types/assistant'

const STORAGE_KEY = 'apex-voice-assistant-voice'
export const DEFAULT_VOICE: AssistantVoice = 'diana'

export const VOICE_OPTIONS: readonly { id: AssistantVoice; label: string }[] = [
  { id: 'diana', label: 'Diana (female)' },
  { id: 'hannah', label: 'Hannah (female)' },
  { id: 'autumn', label: 'Autumn (female)' },
  { id: 'austin', label: 'Austin (male)' },
  { id: 'daniel', label: 'Daniel (male)' },
  { id: 'troy', label: 'Troy (male)' },
]

/** The voice chosen on this device, or the default. */
export function readStoredVoice(): AssistantVoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return ASSISTANT_VOICES.find((voice) => voice === stored) ?? DEFAULT_VOICE
  } catch {
    return DEFAULT_VOICE
  }
}

export function writeStoredVoice(voice: AssistantVoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, voice)
  } catch {
    // storage unavailable; the choice lasts until the page is closed
  }
}
