export interface Language {
  /** ISO 639-1 code. */
  code: string
  name: string
  /** Whisper can recognise speech in this language, so it can be chosen as the language being spoken. */
  speech: boolean
  /** The language model writes it less reliably than the others, so the picker flags it. */
  beta?: boolean
}

/** Whisper's supported languages that matter most here, plus Zulu and Xhosa, which can be written but not recognised. */
export const LANGUAGES: readonly Language[] = [
  { code: 'en', name: 'English', speech: true },
  { code: 'af', name: 'Afrikaans', speech: true },
  { code: 'es', name: 'Spanish', speech: true },
  { code: 'fr', name: 'French', speech: true },
  { code: 'de', name: 'German', speech: true },
  { code: 'pt', name: 'Portuguese', speech: true },
  { code: 'nl', name: 'Dutch', speech: true },
  { code: 'it', name: 'Italian', speech: true },
  { code: 'sw', name: 'Swahili', speech: true },
  { code: 'sn', name: 'Shona', speech: true, beta: true },
  { code: 'ar', name: 'Arabic', speech: true },
  { code: 'hi', name: 'Hindi', speech: true },
  { code: 'zh', name: 'Chinese', speech: true },
  { code: 'ja', name: 'Japanese', speech: true },
  { code: 'ru', name: 'Russian', speech: true },
  { code: 'zu', name: 'Zulu', speech: false, beta: true },
  { code: 'xh', name: 'Xhosa', speech: false, beta: true },
]

export const AUTO = 'auto'
export const SAME = 'same'

const byCode = new Map(LANGUAGES.map((language) => [language.code, language]))

export function languageName(code: string): string {
  return byCode.get(code)?.name ?? code
}

export const SPOKEN_CODES: readonly string[] = [AUTO, ...LANGUAGES.filter((l) => l.speech).map((l) => l.code)]
export const WRITE_CODES: readonly string[] = [SAME, ...LANGUAGES.map((l) => l.code)]
