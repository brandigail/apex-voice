export const DRAFT_CATEGORIES = ['EMAIL', 'QUOTE', 'WHATSAPP', 'SMS', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'NOTE'] as const

export type DraftCategory = (typeof DRAFT_CATEGORIES)[number]

/** The structured fields the LLM returns for a transcript. */
export interface GeneratedDraft {
  category: DraftCategory
  recipient: string
  subject: string
  body: string
}

/** A saved draft. Timestamps are ISO 8601 strings. */
export interface Draft extends GeneratedDraft {
  id: string
  transcript: string
  createdAt: string
  updatedAt: string
}
