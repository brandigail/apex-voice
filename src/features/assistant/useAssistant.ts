import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiRequestError, transcribeRecording } from '../../lib/api'
import { askAssistant } from '../../lib/assistant-api'
import { authClient } from '../../lib/auth-client'
import { startBackgroundListening, stopBackgroundListening } from '../../lib/native-listening'
import type { AssistantAction, AssistantTurn } from '../../types/assistant'
import { readSpokenLanguage } from '../language/languageSettings'
import { Listener, ScreenLock, type Utterance } from './listener'
import { SpeechPlayer } from './speech'

export type AssistantPhase = 'idle' | 'starting' | 'listening' | 'hearing' | 'thinking' | 'speaking'

export interface ChatLine {
  id: number
  role: 'user' | 'assistant'
  text: string
  actions: AssistantAction[]
}

/** The assistant is shown the last few turns only, which keeps replies fast and the request small. */
const HISTORY_TURNS = 8

interface Session {
  id: number
  /** Groups this conversation's turns in the saved history. */
  conversationId: string
  listener: Listener
  player: SpeechPlayer
  lock: ScreenLock
  history: AssistantTurn[]
}

function messageFrom(err: unknown): string {
  return err instanceof ApiRequestError || err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

export interface UseAssistant {
  phase: AssistantPhase
  lines: ChatLine[]
  error: string | null
  /** Attach to the element that shows the orb; its `--level` CSS variable follows the microphone. */
  orbRef: React.RefObject<HTMLDivElement | null>
  /** Tap on the orb: start, "I'm done talking", or interrupt, depending on what is happening. */
  tapOrb: () => void
  end: () => void
  clear: () => void
}

export function useAssistant(firstName: string): UseAssistant {
  const [phase, setPhase] = useState<AssistantPhase>('idle')
  const [lines, setLines] = useState<ChatLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const orbRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const nextIdRef = useRef(1)

  /** A reply or recording that finishes after the user ended the session (or started a new one) is ignored. */
  const isCurrent = useCallback((session: Session) => sessionRef.current?.id === session.id, [])

  const addLine = useCallback((role: ChatLine['role'], text: string, actions: AssistantAction[] = []) => {
    setLines((current) => [...current, { id: nextIdRef.current++, role, text, actions }])
  }, [])

  const end = useCallback(() => {
    const session = sessionRef.current
    sessionRef.current = null
    if (session) {
      session.listener.stop()
      session.player.stop()
      void session.lock.disable()
      void stopBackgroundListening()
    }
    setPhase('idle')
  }, [])

  useEffect(() => end, [end])

  const listenAgain = useCallback((session: Session) => {
    if (!isCurrent(session)) return
    session.listener.listen()
    setPhase('listening')
  }, [isCurrent])

  const speakReply = useCallback(
    async (session: Session, text: string, language?: string) => {
      if (!isCurrent(session)) return
      setPhase('speaking')
      await session.player.speak(text, language)
    },
    [isCurrent],
  )

  const respond = useCallback(
    async (session: Session, text: string) => {
      addLine('user', text)
      session.history.push({ role: 'user', content: text })
      setPhase('thinking')
      try {
        const reply = await askAssistant(session.history.slice(-HISTORY_TURNS), session.conversationId, readSpokenLanguage())
        if (!isCurrent(session)) return
        session.history.push({ role: 'assistant', content: reply.reply, actions: reply.actions })
        addLine('assistant', reply.reply, reply.actions)
        await speakReply(session, reply.reply, reply.speechLanguage)
      } catch (err) {
        if (!isCurrent(session)) return
        if (err instanceof ApiRequestError && err.status === 401) void authClient.signOut()
        setError(messageFrom(err))
        // A daily or per-minute cap won't clear by listening again, so stop and say why.
        if (err instanceof ApiRequestError && err.status === 429) {
          end()
          return
        }
      }
      listenAgain(session)
    },
    [addLine, end, isCurrent, listenAgain, speakReply],
  )

  const handleUtterance = useCallback(
    async (session: Session, utterance: Utterance) => {
      setPhase('thinking')
      try {
        const text = await transcribeRecording(utterance.segments, utterance.mimeType, readSpokenLanguage(), true)
        if (!isCurrent(session)) return
        if (text) {
          setError(null)
          await respond(session, text)
          return
        }
      } catch (err) {
        if (!isCurrent(session)) return
        if (err instanceof ApiRequestError && err.status === 401) void authClient.signOut()
        setError(messageFrom(err))
        if (err instanceof ApiRequestError && err.status === 429) {
          end()
          return
        }
      }
      listenAgain(session)
    },
    [end, isCurrent, listenAgain, respond],
  )

  const start = useCallback(async () => {
    if (sessionRef.current) return
    setError(null)
    setPhase('starting')

    const player = new SpeechPlayer()
    player.unlock()
    const lock = new ScreenLock()
    let session: Session | null = null
    const listener = new Listener({
      onLevel: (level) => orbRef.current?.style.setProperty('--level', level.toFixed(3)),
      onHearing: (hearing) =>
        setPhase((current) => (current === 'listening' || current === 'hearing' ? (hearing ? 'hearing' : 'listening') : current)),
      onUtterance: (utterance) => session && void handleUtterance(session, utterance),
      onIdleTimeout: () => {
        setError('I stopped listening because it has been quiet for a while. Tap the orb when you are ready.')
        end()
      },
      onInterrupted: () => {
        setError('Listening was interrupted, for example by locking the screen or a phone call. Tap the orb to start again.')
        end()
      },
      onError: (message) => {
        setError(message)
        if (session) listenAgain(session)
      },
    })

    try {
      await listener.start()
    } catch (err) {
      setError(messageFrom(err))
      setPhase('idle')
      return
    }

    session = { id: Date.now(), conversationId: crypto.randomUUID(), listener, player, lock, history: [] }
    sessionRef.current = session
    void lock.enable()
    // In the Android app this keeps the microphone alive with the screen off; in a browser it does nothing.
    void startBackgroundListening()

    const greeting = firstName ? `Hi ${firstName}, I'm listening. What can I do for you?` : "Hi, I'm listening. What can I do for you?"
    addLine('assistant', greeting)
    await speakReply(session, greeting)
    listenAgain(session)
  }, [addLine, end, firstName, handleUtterance, listenAgain, speakReply])

  const tapOrb = useCallback(() => {
    const session = sessionRef.current
    if (!session) {
      if (phase === 'idle') void start()
      return
    }
    if (phase === 'hearing') session.listener.finishNow()
    else if (phase === 'speaking') session.player.stop() // speakReply resolves and listening resumes
  }, [phase, start])

  const clear = useCallback(() => setLines([]), [])

  return { phase, lines, error, orbRef, tapOrb, end, clear }
}
