import type { GenerateResponse } from '../../src/types/api.ts'
import { generateRequestSchema } from '../../src/types/draft-schema.ts'
import { writeDraft } from './_lib/draft-generator.ts'
import { errorResponse, json } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'

/** Netlify's default function timeout is 10 s; the whole call, retry included, must fit inside it. */
const DEADLINE_MS = 9_000

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.')

  const session = await requireUser(req)
  if (!session.ok) return session.response

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('GROQ_API_KEY is not configured')
    return errorResponse(500, 'Server is not configured.')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'Send a JSON body.')
  }
  const request = generateRequestSchema.safeParse(body)
  if (!request.success) return errorResponse(400, 'A transcript of 1 to 10,000 characters is required.')

  const quota = await claimQuota(session.user.id, 'generate')
  if (!quota.ok) return quota.response

  const { category, transcript } = request.data
  const result = await writeDraft({ apiKey, category, transcript, profile: session.user.profile, deadlineMs: DEADLINE_MS })
  return result.ok ? json<GenerateResponse>({ draft: result.draft }) : errorResponse(result.status, result.message)
}
