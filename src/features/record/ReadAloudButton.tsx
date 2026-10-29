import { useEffect, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { forSpeech, pickBrowserVoice } from '../assistant/speech'

interface ReadAloudButtonProps {
  text: string
  /** ISO 639-1 code of the draft, so an Afrikaans draft is read with an Afrikaans voice when the device has one. */
  language: string
}

/** Reads the draft out with the device's own voice (free and instant). A second tap stops it. */
export function ReadAloudButton({ text, language }: ReadAloudButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof speechSynthesis !== 'undefined'

  // Leaving the screen or editing the draft must not leave the old text being read.
  useEffect(
    () => () => {
      if (supported) speechSynthesis.cancel()
    },
    [supported, text],
  )

  if (!supported) return null

  const toggle = () => {
    if (speaking) {
      speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(forSpeech(text))
    utterance.lang = language
    utterance.voice = pickBrowserVoice(language) ?? null
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    speechSynthesis.speak(utterance)
  }

  return (
    <button type="button" onClick={toggle} disabled={text.trim() === ''} aria-pressed={speaking} className="btn btn-ghost">
      {speaking ? <Square className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
      {speaking ? 'Stop reading' : 'Read it to me'}
    </button>
  )
}
