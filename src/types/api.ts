import type { Draft, GeneratedDraft } from './draft.ts'

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
}

export interface GenerateResponse {
  draft: GeneratedDraft
}
