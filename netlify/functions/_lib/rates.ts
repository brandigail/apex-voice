import { CURRENCIES } from '../../../src/types/plans.ts'
import type { RatesResponse } from '../../../src/types/plans.ts'
import { describeError } from './safe-log.ts'

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

/** Today's exchange rates (cached for an hour); an older cached copy is used if both sources are down. */
export async function getRates(): Promise<RatesResponse | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  for (const source of [fromExchangeRateApi, fromFrankfurter]) {
    try {
      const value = await source()
      if (value) {
        cached = { at: Date.now(), value }
        return value
      }
    } catch (err) {
      console.error('Exchange rate source failed:', describeError(err))
    }
  }
  return cached?.value ?? null
}
