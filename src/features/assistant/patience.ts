const STORAGE_KEY = 'apex-voice-assistant-patience'

export type Patience = 'quick' | 'normal' | 'patient'

/** How long Apex waits in silence before it decides you have finished speaking. */
export const PATIENCE_OPTIONS: readonly { id: Patience; label: string; silenceMs: number }[] = [
  { id: 'quick', label: 'Quick (answers sooner, may cut in on pauses)', silenceMs: 1_200 },
  { id: 'normal', label: 'Normal', silenceMs: 2_200 },
  { id: 'patient', label: 'Patient (waits longer for slow speakers)', silenceMs: 3_200 },
]

export const DEFAULT_PATIENCE: Patience = 'normal'

export function readStoredPatience(): Patience {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return PATIENCE_OPTIONS.find((option) => option.id === stored)?.id ?? DEFAULT_PATIENCE
  } catch {
    return DEFAULT_PATIENCE
  }
}

export function writeStoredPatience(patience: Patience): void {
  try {
    localStorage.setItem(STORAGE_KEY, patience)
  } catch {
    // storage unavailable; the choice lasts until the page is closed
  }
}

/** The silence, in milliseconds, that ends a turn for the saved setting. */
export function silenceMs(): number {
  const chosen = readStoredPatience()
  return PATIENCE_OPTIONS.find((option) => option.id === chosen)?.silenceMs ?? 2_200
}
