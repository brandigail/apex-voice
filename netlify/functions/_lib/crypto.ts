import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

/**
 * Application-level encryption for personal content (messages, transcripts, agenda items, the calendar link).
 *
 * The database already encrypts its disks, but that does not stop anyone who reaches the database from reading
 * the rows. Content is therefore scrambled here, before it is saved, with AES-256-GCM. The master key
 * (DATA_ENCRYPTION_KEY) lives only in the server's settings, never in the database, and each person gets their own
 * key derived from it, so one person's data cannot be unlocked with another's key.
 *
 * Format: "enc1:" + base64url(iv + ciphertext + tag). Text without the prefix is old plain-text data and is passed
 * through unchanged, so existing rows keep working until they are converted.
 */

const PREFIX = 'enc1:'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_SALT = 'apex-voice/data-encryption/v1'

let masterKey: Buffer | null = null

function getMasterKey(): Buffer {
  if (masterKey) return masterKey
  const configured = process.env.DATA_ENCRYPTION_KEY
  if (!configured) throw new Error('DATA_ENCRYPTION_KEY is not set')
  const key = Buffer.from(configured, 'base64')
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded')
  masterKey = key
  return key
}

/** One key per scope (a person's id, or a fixed name for account-wide fields), derived so the master key is never used directly. */
function keyFor(scope: string): Buffer {
  return Buffer.from(hkdfSync('sha256', getMasterKey(), KEY_SALT, `scope:${scope}`, 32))
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

/**
 * Encrypts text. `scope` says whose data it is and `field` which column, and both are bound into the ciphertext, so a
 * value copied to another person or another column fails to decrypt instead of being accepted.
 */
export function encryptText(scope: string, field: string, plain: string): string {
  if (plain === '' || isEncrypted(plain)) return plain
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', keyFor(scope), iv)
  cipher.setAAD(Buffer.from(`${scope}|${field}`))
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return PREFIX + Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')
}

/** Decrypts text. Old plain text is returned as it is. Throws if the data was tampered with or the key is wrong. */
export function decryptText(scope: string, field: string, stored: string): string {
  if (!isEncrypted(stored)) return stored
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64url')
  if (raw.length < IV_BYTES + TAG_BYTES) throw new Error('Encrypted value is too short')
  const decipher = createDecipheriv('aes-256-gcm', keyFor(scope), raw.subarray(0, IV_BYTES))
  decipher.setAAD(Buffer.from(`${scope}|${field}`))
  decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES))
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]).toString('utf8')
}

/** For values that can be null in the database. */
export const encryptOptional = (scope: string, field: string, value: string | null): string | null =>
  value === null ? null : encryptText(scope, field, value)

export const decryptOptional = (scope: string, field: string, value: string | null): string | null =>
  value === null ? null : decryptText(scope, field, value)

/** Encrypts any JSON value (used for the small "what the assistant did" records). Stored as a JSON object so the column type stays jsonb. */
export function encryptJson(scope: string, field: string, value: unknown): { enc: string } {
  return { enc: encryptText(scope, field, JSON.stringify(value)) }
}

export function decryptJson<T>(scope: string, field: string, stored: unknown, fallback: T): T {
  if (stored && typeof stored === 'object' && 'enc' in stored && typeof (stored as { enc: unknown }).enc === 'string') {
    return JSON.parse(decryptText(scope, field, (stored as { enc: string }).enc)) as T
  }
  return (stored as T | null | undefined) ?? fallback
}

export const UNREADABLE = '[This item could not be opened]'

/**
 * Like {@link decryptText}, for lists: an item that cannot be opened (a wrong key, damaged data) becomes a placeholder
 * so one bad row never hides everything else. It logs only that this happened, never any content.
 */
export function openText(scope: string, field: string, stored: string): string {
  try {
    return decryptText(scope, field, stored)
  } catch {
    console.error(`An encrypted value in ${field} could not be opened`)
    return UNREADABLE
  }
}
