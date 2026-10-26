import { encryptText, openText } from './crypto.ts'

/** The columns of a draft that hold personal content, and so are stored encrypted. */
export interface DraftText {
  recipient: string
  subject: string
  body: string
  transcript: string
}

export function encryptDraftText(userId: string, text: DraftText): DraftText {
  return {
    recipient: encryptText(userId, 'drafts.recipient', text.recipient),
    subject: encryptText(userId, 'drafts.subject', text.subject),
    body: encryptText(userId, 'drafts.body', text.body),
    transcript: encryptText(userId, 'drafts.transcript', text.transcript),
  }
}

/** Opens the encrypted columns of a row read from the database; other columns are left as they are. */
export function decryptDraftRow<T extends DraftText>(userId: string, row: T): T {
  return {
    ...row,
    recipient: openText(userId, 'drafts.recipient', row.recipient),
    subject: openText(userId, 'drafts.subject', row.subject),
    body: openText(userId, 'drafts.body', row.body),
    transcript: openText(userId, 'drafts.transcript', row.transcript),
  }
}
