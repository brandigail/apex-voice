import type { RatesResponse } from '../../src/types/plans.ts'
import { featuresFor } from './_lib/features.ts'
import { errorResponse, json } from './_lib/http.ts'
import { getRates } from './_lib/rates.ts'
import { requireUser } from './_lib/session.ts'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse(405, 'Method not allowed.')
  const session = await requireUser(req)
  if (!session.ok) return session.response
  if (!featuresFor(session.user.email).subscriptions) return errorResponse(404, 'Not found.')

  const rates = await getRates()
  return rates ? json<RatesResponse>(rates) : errorResponse(502, 'Exchange rates are unavailable right now.')
}
