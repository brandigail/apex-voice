import type { GeneratedDraft } from '../types/draft'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s()-]{6,}$/

/** Line breaks as CRLF, which mail clients expect inside a mailto body. */
function encodeBody(text: string): string {
  return encodeURIComponent(text.replace(/\r?\n/g, '\r\n'))
}

export type EmailProvider = 'default' | 'gmail' | 'outlook' | 'yahoo'

export const EMAIL_PROVIDERS: readonly { id: EmailProvider; label: string }[] = [
  { id: 'default', label: 'Default mail app' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'yahoo', label: 'Yahoo Mail' },
]

/** Builds a compose link for the chosen mail app. The To address is only filled in when the recipient is an email address, not a spoken name. */
export function buildEmailUrl(provider: EmailProvider, draft: GeneratedDraft): string {
  const to = encodeURIComponent(EMAIL_PATTERN.test(draft.recipient.trim()) ? draft.recipient.trim() : '')
  const subject = encodeURIComponent(draft.subject)
  const body = encodeBody(draft.body)
  switch (provider) {
    case 'gmail':
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`
    case 'outlook':
      return `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subject}&body=${body}`
    case 'yahoo':
      return `https://compose.mail.yahoo.com/?to=${to}&subject=${subject}&body=${body}`
    case 'default':
      return `mailto:${to.replace('%40', '@')}?subject=${subject}&body=${body}`
  }
}

/** `?&body=` works on both iOS and Android. */
export function buildSmsUrl(draft: GeneratedDraft): string {
  const to = PHONE_PATTERN.test(draft.recipient.trim()) ? draft.recipient.replace(/[\s()-]/g, '') : ''
  return `sms:${to}?&body=${encodeURIComponent(draft.body)}`
}

/** WhatsApp needs the full international number, written with a leading "+" or "00". */
export function isInternationalNumber(value: string): boolean {
  const recipient = value.trim()
  return /^(\+|00)/.test(recipient) && PHONE_PATTERN.test(recipient)
}

/** Without an international number the link opens WhatsApp's contact picker instead of a specific chat. */
export function buildWhatsAppUrl(draft: GeneratedDraft): string {
  const recipient = draft.recipient.trim()
  const digits = isInternationalNumber(recipient) ? recipient.replace(/\D/g, '').replace(/^00/, '') : ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(draftToText(draft))}`
}

/** Plain text for the clipboard: for mail, the subject, a blank line, then the body. Chat and social drafts are the body alone. */
export function draftToText(draft: GeneratedDraft): string {
  const subject = draft.subject.trim()
  const hasMailSubject = draft.category === 'EMAIL' || draft.category === 'QUOTE'
  return subject && hasMailSubject ? `${subject}\n\n${draft.body}` : draft.body
}
