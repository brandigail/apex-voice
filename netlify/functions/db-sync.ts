import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import type { ListDraftsResponse, SaveDraftResponse } from '../../src/types/api.ts'
import { markSentRequestSchema, saveDraftSchema } from '../../src/types/draft-schema.ts'
import type { Draft, DraftCategory } from '../../src/types/draft.ts'
import { errorResponse, json } from './_lib/http.ts'
import { requireUser } from './_lib/session.ts'

/** Most drafts one user can keep; stops a client from filling the database with made-up ids. */
const MAX_DRAFTS_PER_USER = 500
const LIST_LIMIT = 200

interface DraftRow {
  id: string
  category: DraftCategory
  recipient: string
  subject: string
  body: string
  transcript: string
  created_at: string | Date
  updated_at: string | Date
  sent_at: string | Date | null
}

const COLUMNS = 'id, category, recipient, subject, body, transcript, created_at, updated_at, sent_at'

function toDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    category: row.category,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    transcript: row.transcript,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
  }
}

/**
 * Routes are /api/drafts and /api/drafts/:id. `netlify dev` retries a 404 as `<path>.html` and then `<path>.htm`,
 * so a trailing `.html` or `.htm` is ignored; otherwise that retry would turn a clean 404 into a confusing
 * "invalid id" 400.
 */
function draftIdFrom(req: Request): string | null {
  const [, , id] = new URL(req.url).pathname.split('/').filter(Boolean)
  return id?.replace(/\.html?$/, '') ?? null
}

export default async function handler(req: Request): Promise<Response> {
  const session = await requireUser(req)
  if (!session.ok) return session.response
  const userId = session.user.id
  const sql = neon(process.env.DATABASE_URL ?? '')
  const id = draftIdFrom(req)

  try {
    if (req.method === 'GET' && id === null) {
      const rows = (await sql.query(
        `SELECT ${COLUMNS} FROM drafts WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`,
        [userId],
      )) as DraftRow[]
      return json<ListDraftsResponse>({ drafts: rows.map(toDraft) })
    }

    if (id !== null && !z.uuid().safeParse(id).success) return errorResponse(400, 'Invalid draft id.')

    if (req.method === 'PUT' && id !== null) return await upsert(req, sql, userId, id)
    if (req.method === 'PATCH' && id !== null) return await markSent(req, sql, userId, id)

    if (req.method === 'DELETE' && id !== null) {
      const deleted = await sql.query('DELETE FROM drafts WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId])
      return deleted.length > 0 ? json({ id }) : errorResponse(404, 'Draft not found.')
    }

    return errorResponse(405, 'Method not allowed.')
  } catch (err) {
    console.error('Draft sync failed:', err)
    return errorResponse(500, 'Could not reach your saved drafts. Please try again.')
  }
}

async function upsert(req: Request, sql: NeonQueryFunction<false, false>, userId: string, id: string): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'Send a JSON body.')
  }
  const parsed = saveDraftSchema.safeParse(body)
  if (!parsed.success || parsed.data.id !== id) return errorResponse(400, 'That draft is not valid.')
  const draft = parsed.data

  const [counts] = (await sql.query(
    'SELECT count(*)::int AS total, (count(*) FILTER (WHERE id = $2))::int AS existing FROM drafts WHERE user_id = $1',
    [userId, id],
  )) as { total: number; existing: number }[]
  if (counts.existing === 0 && counts.total >= MAX_DRAFTS_PER_USER) {
    return errorResponse(403, `You can keep up to ${MAX_DRAFTS_PER_USER} drafts. Delete some to save more.`)
  }

  // The WHERE clause means a draft owned by someone else is never overwritten, even if its id is known.
  const rows = (await sql.query(
    `INSERT INTO drafts (id, user_id, category, recipient, subject, body, transcript, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (id) DO UPDATE SET
       category = EXCLUDED.category, recipient = EXCLUDED.recipient, subject = EXCLUDED.subject,
       body = EXCLUDED.body, transcript = EXCLUDED.transcript, updated_at = now()
     WHERE drafts.user_id = EXCLUDED.user_id
     RETURNING ${COLUMNS}`,
    [id, userId, draft.category, draft.recipient, draft.subject, draft.body, draft.transcript, draft.createdAt],
  )) as DraftRow[]

  return rows.length > 0 ? json<SaveDraftResponse>({ draft: toDraft(rows[0]) }) : errorResponse(404, 'Draft not found.')
}

export const config: Config = { path: ['/api/drafts', '/api/drafts/*'] }

async function markSent(req: Request, sql: NeonQueryFunction<false, false>, userId: string, id: string): Promise<Response> {
  const parsed = markSentRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return errorResponse(400, 'Send {"sent": true} or {"sent": false}.')
  const rows = (await sql.query(
    `UPDATE drafts SET sent_at = CASE WHEN $3 THEN now() ELSE NULL END, updated_at = now()
     WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [id, userId, parsed.data.sent],
  )) as DraftRow[]
  return rows.length > 0 ? json<SaveDraftResponse>({ draft: toDraft(rows[0]) }) : errorResponse(404, 'Draft not found.')
}
