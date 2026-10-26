import { CURRENCIES } from '../../src/types/plans.ts'
import type { RatesResponse } from '../../src/types/plans.ts'
import { featuresFor } from './_lib/features.ts'
import { errorResponse, json } from './_lib/http.ts'
import { requireUser } from './_lib/session.ts'

const CACHE_MS = 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 5_000

interface ErApiResponse {
  result?: string
  time_last_update_utc?: string
  rates?: Record<string, number>
}

interface FrankfurterResponse {
  date?: string
  rates?: Record<string, number>
}

let cached: { at: number; value: RatesResponse } | null = null

/** Daily rates for every currency, no key needed. Primary source. */
async function fromExchangeRateApi(): Promise<RatesResponse | null> {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) return null
  const data = (await response.json()) as ErApiResponse
  if (data.result !== 'success' || !data.rates) return null
  return {
    base: 'USD',
    rates: pick(data.rates),
    asOf: new Date(data.time_last_update_utc ?? Date.now()).toISOString().slice(0, 10),
    source: 'ExchangeRate-API',
  }
}

/** European Central Bank reference rates; fewer currencies but a dependable fallback. */
async function fromFrankfurter(): Promise<RatesResponse | null> {
  const symbols = CURRENCIES.map((c) => c.code).filter((code) => code !== 'USD').join(',')
  const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) return null
  const data = (await response.json()) as FrankfurterResponse
  if (!data.rates || !data.date) return null
  return { base: 'USD', rates: pick({ ...data.rates, USD: 1 }), asOf: data.date, source: 'European Central Bank' }
}

/** Keeps only the currencies the app offers, and only usable numbers. */
function pick(all: Record<string, number>): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const { code } of CURRENCIES) {
    const rate = all[code]
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) rates[code] = rate
  }
  rates.USD = 1
  return rates
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse(405, 'Method not allowed.')
  const session = await requireUser(req)
  if (!session.ok) return session.response
  if (!featuresFor(session.user.email).subscriptions) return errorResponse(404, 'Not found.')

  if (cached && Date.now() - cached.at < CACHE_MS) return json<RatesResponse>(cached.value)
  for (const source of [fromExchangeRateApi, fromFrankfurter]) {
    try {
      const value = await source()
      if (value) {
        cached = { at: Date.now(), value }
        return json<RatesResponse>(value)
      }
    } catch (err) {
      console.error('Exchange rate source failed:', err instanceof Error ? err.message : err)
    }
  }
  // A slightly old rate is better than none.
  return cached ? json<RatesResponse>(cached.value) : errorResponse(502, 'Exchange rates are unavailable right now.')
}
