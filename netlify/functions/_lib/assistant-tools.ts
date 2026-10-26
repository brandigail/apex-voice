import { neon } from '@neondatabase/serverless'
import { z } from 'zod'
import type { AssistantAction } from '../../../src/types/assistant.ts'
import { DRAFT_CATEGORIES, type DraftCategory } from '../../../src/types/draft.ts'
import type { Profile } from '../../../src/types/profile.ts'
import { buildSignature } from '../../../src/lib/profile.ts'
import { addAgendaItem, listAgenda } from './agenda.ts'
import { writeDraft } from './draft-generator.ts'
import type { ToolDefinition } from './groq-chat.ts'
import { addDays, formatWhen, startOfZonedDay, todayIn, zonedToDate } from './time.ts'

export interface ToolContext {
  userId: string
  profile: Profile
  timeZone: string
  apiKey: string
  /** Epoch milliseconds by which the whole request must have finished. */
  deadlineAt: number
  /** Appended to as tools change things, so the screen can show what happened. */
  actions: AssistantAction[]
}

const MAX_RANGE_DAYS = 31
const DEFAULT_MEETING_MINUTES = 60
const DRAFT_SEARCH_LIMIT = 8
const PREVIEW_CHARS = 140

const CATEGORY_ENUM = [...DRAFT_CATEGORIES]

export const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_agenda',
      description:
        "Look up the user's meetings and agenda items (from Apex and their linked calendar). Use it for any question about what is on, when something is, or whether they are free.",
      parameters: {
        type: 'object',
        properties: {
          from_date: { type: 'string', description: 'First day to include, YYYY-MM-DD in the user\'s time zone.' },
          to_date: { type: 'string', description: `Last day to include, YYYY-MM-DD. Same as from_date for a single day. At most ${MAX_RANGE_DAYS} days after from_date.` },
        },
        required: ['from_date', 'to_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_agenda_item',
      description: "Add a meeting, reminder or deadline to the user's Apex agenda. Only call it once the day and time are clear.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title, for example "Meeting with Mr Smith".' },
          start: { type: 'string', description: 'Start in the user\'s local time, YYYY-MM-DDTHH:mm (24 hour).' },
          duration_minutes: { type: 'integer', description: `Length in minutes. Defaults to ${DEFAULT_MEETING_MINUTES}.` },
          notes: { type: 'string', description: 'Optional extra detail such as a location.' },
        },
        required: ['title', 'start'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_drafts',
      description:
        "Search the user's saved emails, quotes and messages, newest first. Each result says whether it has been marked as sent. Use it to answer 'did I already send...' and 'what did I write to...'.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Word or name to look for in the recipient, subject or text, for example "Smith".' },
          category: { type: 'string', enum: CATEGORY_ENUM, description: 'Only this kind of draft.' },
          status: { type: 'string', enum: ['sent', 'unsent', 'any'], description: 'Defaults to any.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_draft',
      description: 'Get the full text of one saved draft, for example to read it aloud.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_draft',
      description:
        "Write and save a new draft (email, quote, WhatsApp, SMS, social post or note) from what the user asked for. Pass their request in their own words with every detail they gave.",
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORY_ENUM },
          instruction: { type: 'string', description: 'Everything the user said about who it is for and what it should say.' },
        },
        required: ['category', 'instruction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_sent',
      description: 'Record that a draft has (or has not) been sent. Only call it after the user says they sent it.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' }, sent: { type: 'boolean' } },
        required: ['id', 'sent'],
      },
    },
  },
]

const getAgendaArgs = z.object({ from_date: z.string(), to_date: z.string() })
const addAgendaArgs = z.object({
  title: z.string().trim().min(1).max(200),
  start: z.string(),
  duration_minutes: z.number().int().min(1).max(24 * 60).optional(),
  notes: z.string().max(500).optional(),
})
const findDraftsArgs = z.object({
  query: z.string().trim().max(100).optional(),
  category: z.enum(DRAFT_CATEGORIES).optional(),
  status: z.enum(['sent', 'unsent', 'any']).optional(),
})
const idArgs = z.object({ id: z.uuid() })
const createDraftArgs = z.object({ category: z.enum(DRAFT_CATEGORIES), instruction: z.string().trim().min(1).max(4000) })
const markSentArgs = z.object({ id: z.uuid(), sent: z.boolean() })

interface DraftRow {
  id: string
  category: DraftCategory
  recipient: string
  subject: string
  body: string
  created_at: string | Date
  sent_at: string | Date | null
}

const fail = (message: string) => JSON.stringify({ error: message })

function label(row: Pick<DraftRow, 'category' | 'recipient' | 'subject'>): string {
  const kind = row.category.toLowerCase()
  return row.recipient ? `${kind} for ${row.recipient}` : row.subject ? `${kind} "${row.subject}"` : kind
}

async function getAgenda(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = getAgendaArgs.safeParse(args)
  const from = parsed.success ? startOfZonedDay(parsed.data.from_date, ctx.timeZone) : null
  const lastDay = parsed.success ? startOfZonedDay(parsed.data.to_date, ctx.timeZone) : null
  if (!from || !lastDay || lastDay < from) return fail('Give from_date and to_date as YYYY-MM-DD.')
  const to = addDays(lastDay, 1)
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) return fail(`Ask for at most ${MAX_RANGE_DAYS} days at a time.`)

  const agenda = await listAgenda(ctx.userId, ctx.profile.calendarUrl, from, to)
  return JSON.stringify({
    items: agenda.items.map((item) => ({
      title: item.title,
      when: formatWhen(item.startsAt, ctx.timeZone, item.allDay),
      allDay: item.allDay,
      source: item.source,
    })),
    note: agenda.calendarError
      ? `The linked calendar could not be read (${agenda.calendarError}). Only Apex items are shown; say so.`
      : agenda.calendarLinked
        ? undefined
        : 'No calendar is linked, so this is only what was added in Apex.',
  })
}

async function addToAgenda(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = addAgendaArgs.safeParse(args)
  if (!parsed.success) return fail('Give a title and a start time as YYYY-MM-DDTHH:mm.')
  const start = zonedToDate(parsed.data.start, ctx.timeZone)
  if (!start) return fail('The start time was not valid. Use YYYY-MM-DDTHH:mm.')
  const end = new Date(start.getTime() + (parsed.data.duration_minutes ?? DEFAULT_MEETING_MINUTES) * 60_000)

  const added = await addAgendaItem(ctx.userId, {
    title: parsed.data.title,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    notes: parsed.data.notes ?? '',
  })
  if (!added.ok) return fail(added.message)
  const when = formatWhen(added.item.startsAt, ctx.timeZone, false)
  ctx.actions.push({ type: 'agenda_added', id: added.item.id, label: `${added.item.title}, ${when}` })
  return JSON.stringify({ added: true, title: added.item.title, when })
}

async function findDrafts(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = findDraftsArgs.safeParse(args)
  if (!parsed.success) return fail('Those search details were not valid.')
  const { query, category, status = 'any' } = parsed.data
  const sql = neon(process.env.DATABASE_URL ?? '')
  const rows = (await sql.query(
    `SELECT id, category, recipient, subject, body, created_at, sent_at FROM drafts
     WHERE user_id = $1
       AND ($2::text IS NULL OR category = $2)
       AND ($3::text IS NULL OR recipient ILIKE '%' || $3 || '%' OR subject ILIKE '%' || $3 || '%' OR body ILIKE '%' || $3 || '%')
       AND ($4 = 'any' OR ($4 = 'sent' AND sent_at IS NOT NULL) OR ($4 = 'unsent' AND sent_at IS NULL))
     ORDER BY created_at DESC LIMIT ${DRAFT_SEARCH_LIMIT}`,
    [ctx.userId, category ?? null, query ? query.replace(/[%_\\]/g, '\\$&') : null, status],
  )) as DraftRow[]

  return JSON.stringify({
    drafts: rows.map((row) => ({
      id: row.id,
      kind: row.category,
      recipient: row.recipient,
      subject: row.subject,
      preview: row.body.slice(0, PREVIEW_CHARS),
      written: formatWhen(new Date(row.created_at).toISOString(), ctx.timeZone, false),
      sent: row.sent_at ? `yes, marked sent ${formatWhen(new Date(row.sent_at).toISOString(), ctx.timeZone, false)}` : 'no, still a draft',
    })),
  })
}

async function getDraft(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = idArgs.safeParse(args)
  if (!parsed.success) return fail('Give the draft id.')
  const sql = neon(process.env.DATABASE_URL ?? '')
  const [row] = (await sql.query(
    'SELECT id, category, recipient, subject, body, created_at, sent_at FROM drafts WHERE id = $1 AND user_id = $2',
    [parsed.data.id, ctx.userId],
  )) as DraftRow[]
  if (!row) return fail('That draft was not found.')
  // The signature is for the page, not for a voice to read out.
  const signature = buildSignature(ctx.profile)
  const body = signature && row.body.endsWith(signature) ? row.body.slice(0, -signature.length).trimEnd() : row.body
  return JSON.stringify({ kind: row.category, recipient: row.recipient, subject: row.subject, body })
}

async function createDraft(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = createDraftArgs.safeParse(args)
  if (!parsed.success) return fail('Give a category and the instruction.')
  const { category, instruction } = parsed.data

  const remaining = ctx.deadlineAt - Date.now()
  const result = await writeDraft({ apiKey: ctx.apiKey, category, transcript: instruction, profile: ctx.profile, deadlineMs: remaining })
  if (!result.ok) return fail(result.message)

  const { draft } = result
  const sql = neon(process.env.DATABASE_URL ?? '')
  const [{ total }] = (await sql.query('SELECT count(*)::int AS total FROM drafts WHERE user_id = $1', [ctx.userId])) as { total: number }[]
  if (total >= 500) return fail('The user already has 500 drafts, so nothing was saved. Ask them to delete some.')
  const [saved] = (await sql.query(
    `INSERT INTO drafts (user_id, category, recipient, subject, body, transcript)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [ctx.userId, draft.category, draft.recipient, draft.subject, draft.body, instruction],
  )) as { id: string }[]

  ctx.actions.push({ type: 'draft_created', id: saved.id, category: draft.category, label: label(draft) })
  return JSON.stringify({ saved: true, id: saved.id, kind: draft.category, recipient: draft.recipient, subject: draft.subject, body: draft.body })
}

async function markSent(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = markSentArgs.safeParse(args)
  if (!parsed.success) return fail('Give the draft id and whether it was sent.')
  const sql = neon(process.env.DATABASE_URL ?? '')
  const [row] = (await sql.query(
    `UPDATE drafts SET sent_at = CASE WHEN $3 THEN now() ELSE NULL END, updated_at = now()
     WHERE id = $1 AND user_id = $2 RETURNING id, category, recipient, subject`,
    [parsed.data.id, ctx.userId, parsed.data.sent],
  )) as Pick<DraftRow, 'id' | 'category' | 'recipient' | 'subject'>[]
  if (!row) return fail('That draft was not found.')
  if (parsed.data.sent) ctx.actions.push({ type: 'marked_sent', id: row.id, label: label(row) })
  return JSON.stringify({ updated: true, sent: parsed.data.sent })
}

/** Runs one tool the model asked for. Errors become a message the model can relay instead of crashing the turn. */
export async function runTool(name: string, rawArguments: string, ctx: ToolContext): Promise<string> {
  let args: unknown
  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {}
  } catch {
    return fail('The tool arguments were not valid JSON.')
  }
  try {
    switch (name) {
      case 'get_agenda':
        return await getAgenda(args, ctx)
      case 'add_agenda_item':
        return await addToAgenda(args, ctx)
      case 'find_drafts':
        return await findDrafts(args, ctx)
      case 'get_draft':
        return await getDraft(args, ctx)
      case 'create_draft':
        return await createDraft(args, ctx)
      case 'mark_sent':
        return await markSent(args, ctx)
      default:
        return fail(`There is no tool called ${name}.`)
    }
  } catch (err) {
    console.error(`Assistant tool ${name} failed:`, err)
    return fail('That did not work. Tell the user you could not do it right now.')
  }
}

/** Handy for the system prompt: today and the next few days, so the model can resolve "Thursday" correctly. */
export function upcomingDays(timeZone: string, count = 8, now = new Date()): string {
  const lines: string[] = []
  for (let i = 0; i < count; i++) {
    const day = addDays(now, i)
    const iso = todayIn(timeZone, day)
    const name = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(day)
    lines.push(`${i === 0 ? 'today' : i === 1 ? 'tomorrow' : name}: ${name} ${iso}`)
  }
  return lines.join('\n')
}
