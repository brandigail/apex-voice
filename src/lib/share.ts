import type { GeneratedDraft } from '../types/draft'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s()-]{6,}$/

/** Line breaks as CRLF, which mail clients expect inside a mailto body. */
function encodeBody(text: string): string {
  return encodeURIComponent(text.replace(/\r?\n/g, '\r\n'))
}

/** The To address is only filled in when the recipient is actually an email address, not a spoken name. */
export function buildMailtoUrl(draft: GeneratedDraft): string {
  const to = EMAIL_PATTERN.test(draft.recipient.trim()) ? draft.recipient.trim() : ''
  return `mailto:${to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeBody(draft.body)}`
}

/** `?&body=` works on both iOS and Android. */
export function buildSmsUrl(draft: GeneratedDraft): string {
  const to = PHONE_PATTERN.test(draft.recipient.trim()) ? draft.recipient.replace(/[\s()-]/g, '') : ''
  return `sms:${to}?&body=${encodeURIComponent(draft.body)}`
}

/** Plain text for the clipboard: subject, a blank line, then the body. */
export function draftToText(draft: GeneratedDraft): string {
  const subject = draft.subject.trim()
  return subject ? `${subject}\n\n${draft.body}` : draft.body
}
