import { neon } from '@neondatabase/serverless'
import { errorResponse } from './http.ts'
import { describeError } from './safe-log.ts'

export type MeteredEndpoint = 'transcribe' | 'generate' | 'assistant' | 'listen' | 'speak' | 'calendar' | 'feedback' | 'export'

export interface QuotaLimits {
  /** Calls one user may make in any rolling minute. */
  perMinute: number
  /** Calls one user may make in any rolling 24 hours. */
  perDay: number
  /** Calls all users together may make in any rolling 24 hours; protects the shared Groq quota. */
  globalPerDay: number
}

const DEFAULT_GLOBAL_PER_DAY = 600

function globalPerDay(): number {
  const configured = Number(process.env.GLOBAL_DAILY_LIMIT)
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_GLOBAL_PER_DAY
}

function positiveInt(value: string | undefined, fallback: number): number {
  const configured = Number(value)
  return Number.isInteger(configured) && configured > 0 ? configured : fallback
}

/**
 * The voice assistant is the expensive feature (every turn is a transcription, a reply and several spoken
 * sentences), so it has its own, tighter caps. `ASSISTANT_DAILY_LIMIT` changes the per-user turns a day.
 */
export function limitsFor(endpoint: MeteredEndpoint): QuotaLimits {
  switch (endpoint) {
    case 'transcribe':
      // Every 45 second piece of a recording is one call, so a 5 minute recording is about seven calls.
      return { perMinute: 16, perDay: 120, globalPerDay: Math.max(globalPerDay(), 1500) }
    case 'generate':
      return { perMinute: 10, perDay: 60, globalPerDay: globalPerDay() }
    case 'assistant':
      return { perMinute: 6, perDay: positiveInt(process.env.ASSISTANT_DAILY_LIMIT, 40), globalPerDay: 300 }
    case 'listen':
      return { perMinute: 12, perDay: 80, globalPerDay: 500 }
    case 'export':
      return { perMinute: 2, perDay: 10, globalPerDay: 200 }
    case 'feedback':
      return { perMinute: 5, perDay: 30, globalPerDay: 500 }
    case 'calendar':
      return { perMinute: 10, perDay: 100, globalPerDay: 1000 }
    case 'speak':
      return { perMinute: 24, perDay: 250, globalPerDay: 1500 }
  }
}

interface UsageCounts {
  minute_count: number
  day_count: number
  global_count: number
}

/** Counts a user's recent calls to an endpoint, plus everyone's. `$1` is the user id and `$2` the endpoint. */
const COUNTS_SQL = `
  SELECT
    (count(*) FILTER (WHERE user_id = $1 AND created_at > now() - interval '1 minute'))::int AS minute_count,
    (count(*) FILTER (WHERE user_id = $1))::int AS day_count,
    count(*)::int AS global_count
  FROM api_usage
  WHERE endpoint = $2 AND created_at > now() - interval '24 hours'`

/** Records the call only if every limit still has room, in one statement so concurrent calls can't all slip through. */
const CLAIM_SQL = `
  WITH counts AS (${COUNTS_SQL})
  INSERT INTO api_usage (user_id, endpoint)
  SELECT $1, $2 FROM counts
  WHERE minute_count < $3 AND day_count < $4 AND global_count < $5
  RETURNING id`

/** Old usage rows are only needed for the 24 hour window; trim them now and then instead of running a cron job. */
const PRUNE_SQL = `DELETE FROM api_usage WHERE created_at < now() - interval '3 days'`
const PRUNE_ONE_IN = 50

type QuotaResult = { ok: true } | { ok: false; response: Response }

/**
 * Counts one call against the user's quota. Call it after the request has been validated and before the
 * expensive upstream call, and return `response` as-is when `ok` is false. Fails closed if the database is down.
 */
export async function claimQuota(
  userId: string,
  endpoint: MeteredEndpoint,
  limits: QuotaLimits = limitsFor(endpoint),
): Promise<QuotaResult> {
  try {
    const sql = neon(process.env.DATABASE_URL ?? '')
    const claimed = await sql.query(CLAIM_SQL, [userId, endpoint, limits.perMinute, limits.perDay, limits.globalPerDay])
    if (claimed.length > 0) {
      if (Math.random() < 1 / PRUNE_ONE_IN) await sql.query(PRUNE_SQL).catch(() => undefined)
      return { ok: true }
    }

    const [counts] = (await sql.query(COUNTS_SQL, [userId, endpoint])) as UsageCounts[]
    return { ok: false, response: denial(counts, limits, endpoint) }
  } catch (err) {
    console.error('Quota check failed:', describeError(err))
    return { ok: false, response: errorResponse(503, 'Could not check your usage limit. Please try again.') }
  }
}

const NOUN: Record<MeteredEndpoint, string> = {
  transcribe: 'recordings',
  generate: 'drafts',
  assistant: 'assistant turns',
  listen: 'assistant voice clips',
  speak: 'spoken replies',
  calendar: 'calendar checks',
  feedback: 'feedback notes',
  export: 'data downloads',
}

function denial(counts: UsageCounts, limits: QuotaLimits, endpoint: MeteredEndpoint): Response {
  const noun = NOUN[endpoint]
  if (counts.day_count >= limits.perDay) {
    return errorResponse(429, `You have reached the limit of ${limits.perDay} ${noun} in 24 hours. Please try again later.`)
  }
  if (counts.global_count >= limits.globalPerDay) {
    return errorResponse(429, 'Apex Voice has reached its daily usage limit. Please try again later.')
  }
  const response = errorResponse(429, 'You are going a little fast. Wait a minute and try again.')
  response.headers.set('Retry-After', '60')
  return response
}
