import { ASSISTANT_VOICES, type AssistantVoice } from '../../types/assistant'

const STORAGE_KEY = 'apex-voice-assistant-voice'
export const DEFAULT_VOICE: AssistantVoice = 'diana'

/** The phone's or computer's own voice: starts instantly and never runs out, but sounds less natural. */
export const DEVICE_VOICE = 'device'
export type VoiceChoice = AssistantVoice | typeof DEVICE_VOICE

export const VOICE_OPTIONS: readonly { id: VoiceChoice; label: string }[] = [
  { id: DEVICE_VOICE, label: 'Device voice (instant, less natural)' },
  { id: 'diana', label: 'Diana (female)' },
  { id: 'hannah', label: 'Hannah (female)' },
  { id: 'autumn', label: 'Autumn (female)' },
  { id: 'austin', label: 'Austin (male)' },
  { id: 'daniel', label: 'Daniel (male)' },
  { id: 'troy', label: 'Troy (male)' },
]

/** The voice chosen on this device, or the default. */
export function readStoredVoice(): VoiceChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === DEVICE_VOICE) return DEVICE_VOICE
    return ASSISTANT_VOICES.find((voice) => voice === stored) ?? DEFAULT_VOICE
  } catch {
    return DEFAULT_VOICE
  }
}

export function writeStoredVoice(voice: VoiceChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, voice)
  } catch {
    // storage unavailable; the choice lasts until the page is closed
  }
}
