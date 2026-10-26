import { useState } from 'react'
import { AUTO, LANGUAGES, SAME } from '../../types/languages'
import { readSpokenLanguage, readWriteLanguage, writeSpokenLanguage, writeWriteLanguage } from './languageSettings'

interface SelectProps {
  id: string
}

/** Which language the user is speaking. Naming it makes recognition noticeably more accurate, for Afrikaans especially. */
export function SpokenLanguageSelect({ id }: SelectProps) {
  const [value, setValue] = useState(readSpokenLanguage)
  return (
    <div className="flex-1 text-left">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        I will speak
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          writeSpokenLanguage(e.target.value)
          setValue(e.target.value)
        }}
        className="field"
      >
        <option value={AUTO}>Detect automatically</option>
        {LANGUAGES.filter((language) => language.speech).map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Which language the finished draft is written in, so a message can be spoken in one language and sent in another. */
export function WriteLanguageSelect({ id }: SelectProps) {
  const [value, setValue] = useState(readWriteLanguage)
  return (
    <div className="flex-1 text-left">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        Write it in
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          writeWriteLanguage(e.target.value)
          setValue(e.target.value)
        }}
        className="field"
      >
        <option value={SAME}>Same language I speak</option>
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
            {language.beta ? ' (check before sending)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
