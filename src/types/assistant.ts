import type { DraftCategory } from './draft.ts'

export interface AssistantTurn {
  role: 'user' | 'assistant'
  content: string
  /** What the assistant did when it said this, sent back so it still knows the id of a draft it just wrote. */
  actions?: AssistantAction[]
}

export interface AssistantRequest {
  /** The latest turns, oldest first, ending with what the user just said. Tool results are never sent by the client. */
  messages: AssistantTurn[]
  /** IANA zone such as "Africa/Johannesburg", so "tomorrow at ten" means the user's tomorrow. */
  timeZone: string
  /** Groups the turns of one conversation so they can be listed together in the history. */
  conversationId: string
  /** The language being spoken, or "auto", so recognition is more accurate. */
  spokenLanguage?: string
}

/** Things the assistant did on the user's behalf this turn, so the screen can show them. */
export type AssistantAction =
  | { type: 'draft_created'; id: string; category: DraftCategory; label: string }
  | { type: 'agenda_added'; id: string; label: string }
  | { type: 'marked_sent'; id: string; label: string }
  | { type: 'send_scheduled'; id: string; label: string }

export interface AssistantResponse {
  reply: string
  actions: AssistantAction[]
  /** Set when the reply reads a draft that is not in English, so it is spoken with a matching voice. */
  speechLanguage?: string
}

/** The voices Groq's Orpheus model offers. */
export const ASSISTANT_VOICES = ['hannah', 'diana', 'autumn', 'austin', 'daniel', 'troy'] as const
export type AssistantVoice = (typeof ASSISTANT_VOICES)[number]

/** Most characters of text one speech request may carry (Groq's Orpheus model limit). */
export const MAX_SPEECH_CHARS = 200
