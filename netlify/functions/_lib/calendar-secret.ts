import { decryptText, encryptText, isEncrypted } from './crypto.ts'
import { describeError } from './safe-log.ts'

/** The calendar link is not tied to one person's id at the moment it is saved, so it uses a fixed scope of its own. */
const SCOPE = 'account-fields'
const FIELD = 'user.calendarUrl'

/** Encrypts the calendar link inside a profile update, leaving empty values (no calendar) and already-encrypted ones alone. */
export function sealCalendarLink<T extends object>(data: T): T {
  const url = (data as { calendarUrl?: unknown }).calendarUrl
  if (typeof url !== 'string' || url.trim() === '' || isEncrypted(url)) return data
  return { ...data, calendarUrl: encryptText(SCOPE, FIELD, url.trim()) }
}

/** The plain calendar link for server use. If it cannot be opened it is treated as not linked, never shown as garbage. */
export function openCalendarLink(stored: string): string {
  if (!stored) return ''
  try {
    return decryptText(SCOPE, FIELD, stored)
  } catch (err) {
    console.error('The saved calendar link could not be opened:', describeError(err))
    return ''
  }
}
