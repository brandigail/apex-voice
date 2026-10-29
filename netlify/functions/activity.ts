import { z } from 'zod'
import { logActivity } from './_lib/activity.ts'
import { errorResponse } from './_lib/http.ts'
import { requireUser } from './_lib/session.ts'

/** Events the browser may report; anything else is ignored. */
const CLIENT_KINDS = ['session_start', 'client_error', 'draft_action', 'screen', 'install_hint'] as const

const requestSchema = z.object({
  kind: z.enum(CLIENT_KINDS),
  detail: z.record(z.string().max(40), z.unknown()).default({}),
})

/** Receives a tester's on-screen actions and errors. Always answers 204, so a non-tester's page sees nothing unusual. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.')
  const session = await requireUser(req)
  if (!session.ok) return session.response
  const request = requestSchema.safeParse(await req.json().catch(() => null))
  if (request.success) await logActivity(session.user, request.data.kind, request.data.detail)
  return new Response(null, { status: 204 })
}
