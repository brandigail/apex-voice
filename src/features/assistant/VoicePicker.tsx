import { useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { AssistantVoice } from '../../types/assistant'
import { SpeechPlayer } from './speech'
import { VOICE_OPTIONS, readStoredVoice, writeStoredVoice } from './voice'

const SAMPLE = "Hi, I'm Apex. This is how I'll sound when we talk."

/** Lets the user choose how Apex sounds and hear it before starting a conversation. */
export function VoicePicker() {
  const [voice, setVoice] = useState<AssistantVoice>(readStoredVoice)
  const [playing, setPlaying] = useState(false)
  const playerRef = useRef<SpeechPlayer | null>(null)

  const choose = (next: AssistantVoice) => {
    writeStoredVoice(next)
    setVoice(next)
  }

  const preview = async () => {
    playerRef.current ??= new SpeechPlayer()
    const player = playerRef.current
    player.unlock()
    setPlaying(true)
    try {
      await player.speak(SAMPLE)
    } finally {
      setPlaying(false)
    }
  }

  return (
    <div className="surface flex w-full max-w-md flex-col gap-2 p-4 text-left sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="assistant-voice" className="mb-1.5 block text-sm font-semibold">
          Apex's voice
        </label>
        <select id="assistant-voice" value={voice} onChange={(e) => choose(e.target.value as AssistantVoice)} className="field">
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
  )
}
