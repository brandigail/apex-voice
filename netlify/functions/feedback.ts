import { neon } from '@neondatabase/serverless'
import { z } from 'zod'
import { errorResponse, json } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'

const requestSchema = z.object({
  message: z.string().trim().min(3).max(2_000),
  /** Which screen the person was on, so a comment can be understood in context. */
  screen: z.string().trim().max(40).default(''),
})

/** Saves a note from a tester. Only the signed-in person's id is stored with it; the owner reads the notes in the database. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.')
  const session = await requireUser(req)
  if (!session.ok) return session.response

  const request = requestSchema.safeParse(await req.json().catch(() => null))
  if (!request.success) return errorResponse(400, 'Write a few words (up to 2,000 characters).')

  const quota = await claimQuota(session.user.id, 'feedback')
  if (!quota.ok) return quota.response

  try {
    const sql = neon(process.env.DATABASE_URL ?? '')
    await sql.query('INSERT INTO feedback (user_id, message, screen) VALUES ($1, $2, $3)', [
      session.user.id,
      request.data.message,
      request.data.screen,
    ])
    return json({ saved: true }, 201)
  } catch (err) {
    console.error('Feedback could not be saved:', err instanceof Error ? err.message : err)
    return errorResponse(500, 'Could not save your note. Please try again.')
  }
}
