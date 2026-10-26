import { useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { SpokenLanguageSelect } from '../language/LanguageSelect'
import { SpeechPlayer } from './speech'
import { PATIENCE_OPTIONS, readStoredPatience, writeStoredPatience, type Patience } from './patience'
import { VOICE_OPTIONS, readStoredVoice, writeStoredVoice, type VoiceChoice } from './voice'

/** Lets the user choose how Apex sounds and hear it before starting a conversation. */
export function VoicePicker() {
  const [voice, setVoice] = useState<VoiceChoice>(readStoredVoice)
  const [patience, setPatience] = useState<Patience>(readStoredPatience)
  const [playing, setPlaying] = useState(false)
  const playerRef = useRef<SpeechPlayer | null>(null)

  const choose = (next: VoiceChoice) => {
    writeStoredVoice(next)
    setVoice(next)
  }

  const choosePatience = (next: Patience) => {
    writeStoredPatience(next)
    setPatience(next)
  }

  const preview = async () => {
    playerRef.current ??= new SpeechPlayer()
    const player = playerRef.current
    player.unlock()
    setPlaying(true)
    try {
      await player.playSample()
    } finally {
      setPlaying(false)
    }
  }

  return (
    <div className="surface flex w-full max-w-md flex-col gap-3 p-4 text-left">
      <SpokenLanguageSelect id="assistant-spoken-language" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="assistant-voice" className="mb-1.5 block text-sm font-semibold">
          Apex's voice
        </label>
        <select id="assistant-voice" value={voice} onChange={(e) => choose(e.target.value as VoiceChoice)} className="field">
          {VOICE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={() => void preview()} disabled={playing} className="btn btn-ghost">
        <Volume2 className="size-4" aria-hidden="true" />
        {playing ? 'Playing…' : 'Hear it'}
      </button>
      </div>
      <div>
        <label htmlFor="assistant-patience" className="mb-1.5 block text-sm font-semibold">
          How long I wait before answering
        </label>
        <select id="assistant-patience" value={patience} onChange={(e) => choosePatience(e.target.value as Patience)} className="field">
          {PATIENCE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
