import { AUTO, SAME, SPOKEN_CODES, WRITE_CODES } from '../../types/languages'

const SPOKEN_KEY = 'apex-voice-spoken-language'
const WRITE_KEY = 'apex-voice-write-language'

function read(key: string, allowed: readonly string[], fallback: string): string {
  try {
    const stored = localStorage.getItem(key)
    return stored && allowed.includes(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable; the choice lasts until the page is closed
  }
}

/** The language the user says they speak ("auto" lets the recogniser decide). */
export const readSpokenLanguage = () => read(SPOKEN_KEY, SPOKEN_CODES, AUTO)
export const writeSpokenLanguage = (code: string) => write(SPOKEN_KEY, code)

/** The language drafts are written in ("same" keeps whatever was spoken, "af" translates to Afrikaans, and so on). */
export const readWriteLanguage = () => read(WRITE_KEY, WRITE_CODES, SAME)
export const writeWriteLanguage = (code: string) => write(WRITE_KEY, code)
