import { neon } from '@neondatabase/serverless'
import { encryptText } from './crypto.ts'
import { describeError } from './safe-log.ts'

/** Most events one logged account can store in a day; stops a runaway page from filling the table. */
export const DAILY_EVENT_CAP = 3_000

/**
 * Whether this account is on the tester list: `ACTIVITY_LOG_EMAILS` is a comma separated list of emails. Unset means
 * nobody. If `ACTIVITY_LOG_UNTIL` (a date like 2026-11-30) is set, logging stops by itself after that day.
 */
export function isLogged(email: string): boolean {
  const until = process.env.ACTIVITY_LOG_UNTIL?.trim()
  if (until && Date.now() > Date.parse(`${until}T23:59:59Z`)) return false
  return (process.env.ACTIVITY_LOG_EMAILS ?? '')
    .toLowerCase()
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(email.toLowerCase())
}

interface Subject {
  id: string
  email: string
}

/**
 * Records what a tester did so the owner can find out why something went wrong. Does nothing for other accounts, and
 * never throws: a logging problem must not break the feature being used. The detail is encrypted like drafts are.
 */
export async function logActivity(user: Subject, kind: string, detail: Record<string, unknown> = {}): Promise<void> {
  if (!isLogged(user.email)) return
  try {
    const sql = neon(process.env.DATABASE_URL ?? '')
    const [{ total }] = (await sql.query(
      "SELECT count(*)::int AS total FROM activity_log WHERE user_id = $1 AND created_at > now() - interval '1 day'",
      [user.id],
    )) as { total: number }[]
    if (total >= DAILY_EVENT_CAP) return
    await sql.query('INSERT INTO activity_log (user_id, kind, detail) VALUES ($1, $2, $3)', [
      user.id,
      kind.slice(0, 40),
      encryptText(user.id, 'activity', JSON.stringify(detail).slice(0, 20_000)),
    ])
  } catch (err) {
    console.error('Activity could not be logged:', describeError(err))
  }
}
