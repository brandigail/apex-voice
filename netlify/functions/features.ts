import type { Features } from '../../src/types/features.ts'
import { featuresFor } from './_lib/features.ts'
import { errorResponse, json } from './_lib/http.ts'
import { requireUser } from './_lib/session.ts'

/** Tells the app which preview features this account may see. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse(405, 'Method not allowed.')
  const session = await requireUser(req)
  if (!session.ok) return session.response
  return json<Features>(featuresFor(session.user.email))
}
