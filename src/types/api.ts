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
}

export interface GenerateResponse {
  draft: GeneratedDraft
}
