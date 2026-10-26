import type { Draft, DraftCategory, GeneratedDraft } from './draft.ts'

export interface ApiError {
  error: string
}

export interface TranscribeResponse {
  text: string
}

export interface ListDraftsResponse {
  drafts: Draft[]
}

export interface SaveDraftResponse {
  draft: Draft
}

export interface GenerateRequest {
  transcript: string
  /** The channel the user chose before recording; it decides the style of the draft. */
  category: DraftCategory
  /** Language to write the draft in: a code from languages.ts, or "same" (the default) to match what was spoken. */
  writeLanguage?: string
  /** Language being spoken, or "auto". Only a hint for the writer; transcription has its own setting. */
  spokenLanguage?: string
}

export interface GenerateResponse {
  draft: GeneratedDraft
}
