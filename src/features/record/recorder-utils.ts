export type RecorderErrorCode = 'unsupported' | 'denied' | 'no-device' | 'in-use' | 'empty' | 'failed'

export interface RecorderError {
  code: RecorderErrorCode
  message: string
}

// Ordered by preference. Safari records mp4 (AAC); Chrome and Firefox record webm or ogg (Opus).
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'] as const

/** First container the browser can record, or undefined to let the browser choose. */
export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

/** File extension for a recorded mime type, used when uploading so the transcriber can sniff the format. */
export function extensionForMime(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'm4a'
  if (base === 'audio/ogg') return 'ogg'
  if (base === 'audio/mpeg') return 'mp3'
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav'
  return 'webm'
}

export function toRecorderError(err: unknown): RecorderError {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        code: 'denied',
        message: 'Microphone access was blocked. Allow it in your browser settings, then try again.',
      }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { code: 'no-device', message: 'No microphone was found on this device.' }
    case 'NotReadableError':
    case 'AbortError':
      return { code: 'in-use', message: 'The microphone is in use by another app. Close it and try again.' }
    default:
      return { code: 'failed', message: 'Recording failed. Please try again.' }
  }
}

export const UNSUPPORTED_ERROR: RecorderError = {
  code: 'unsupported',
  message: 'Recording is not supported in this browser. Use a current Chrome, Edge, Firefox or Safari over HTTPS.',
}

export const EMPTY_ERROR: RecorderError = {
  code: 'empty',
  message: 'No audio was captured. Hold the recording a little longer and try again.',
}
