import type { GeneratedDraft } from './draft.ts'

export interface ApiError {
  error: string
}

export interface TranscribeResponse {
  text: string
}

export interface GenerateRequest {
  transcript: string
}

export interface GenerateResponse {
  draft: GeneratedDraft
}
