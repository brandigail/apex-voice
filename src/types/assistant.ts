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
}

/** Things the assistant did on the user's behalf this turn, so the screen can show them. */
export type AssistantAction =
  | { type: 'draft_created'; id: string; category: DraftCategory; label: string }
  | { type: 'agenda_added'; id: string; label: string }
  | { type: 'marked_sent'; id: string; label: string }

export interface AssistantResponse {
  reply: string
  actions: AssistantAction[]
}

/** Most characters of text one speech request may carry (Groq's Orpheus model limit). */
export const MAX_SPEECH_CHARS = 200
