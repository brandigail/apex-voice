export const DRAFT_CATEGORIES = ['EMAIL', 'QUOTE', 'WHATSAPP', 'SMS', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'NOTE'] as const

export type DraftCategory = (typeof DRAFT_CATEGORIES)[number]

/** The structured fields the LLM returns for a transcript. */
export interface GeneratedDraft {
  category: DraftCategory
  recipient: string
  subject: string
  body: string
  /** ISO 639-1 code of the language the draft is written in, for example "en" or "af". */
  language: string
}

/** A saved draft. Timestamps are ISO 8601 strings. */
export interface Draft extends GeneratedDraft {
  id: string
  transcript: string
  createdAt: string
  updatedAt: string
  /** When the user (or the assistant, on their word) marked it as sent; null while it is still a draft. */
  sentAt: string | null
  /** When the user plans to send it (a reminder, nothing is sent automatically); null if not planned. */
  sendAt: string | null
}

/** What the client uploads when saving: the sent state is changed only through its own call. */
export type SaveDraftInput = Omit<Draft, 'sentAt' | 'sendAt'>

/** Changes to a draft's status: mark it sent (or not) and/or plan when to send it. */
export interface DraftStatusUpdate {
  sent?: boolean
  sendAt?: string | null
}
