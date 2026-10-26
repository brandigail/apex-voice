import { neon } from '@neondatabase/serverless'
import { encryptJson, encryptText, isEncrypted } from '../netlify/functions/_lib/crypto.ts'

/**
 * Converts existing plain-text rows to encrypted ones.
 *
 *   node --env-file=.env.local scripts/encrypt-existing.ts --user someone@example.com            (preview one account)
 *   node --env-file=.env.local scripts/encrypt-existing.ts --user someone@example.com --apply
 *   node --env-file=.env.local scripts/encrypt-existing.ts --all --apply                          (everyone)
 *
 * IMPORTANT: run `--all --apply` only AFTER the version of the app that can read encrypted data is live. Until then the
 * old live site would show encrypted text. Without --apply nothing is changed. Running it twice is safe.
 */
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const all = args.includes('--all')
const emailIndex = args.indexOf('--user')
const email = emailIndex >= 0 ? args[emailIndex + 1] : undefined
if (!all && !email) {
  console.error('Say who to convert: --user <email> or --all. Add --apply to change anything; without it this is a preview.')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL ?? '')
const users = (await sql.query(
  `SELECT id, email, "calendarUrl" FROM "user" ${all ? '' : 'WHERE email = $1'}`,
  all ? [] : [email],
)) as { id: string; email: string; calendarUrl: string | null }[]
if (users.length === 0) {
  console.error('No matching account.')
  process.exit(1)
}

const totals = { drafts: 0, messages: 0, agenda: 0, calendars: 0 }

for (const user of users) {
  // Drafts
  const drafts = (await sql.query('SELECT id, recipient, subject, body, transcript FROM drafts WHERE user_id = $1', [user.id])) as {
    id: string
    recipient: string
    subject: string
    body: string
    transcript: string
  }[]
  for (const row of drafts) {
    if ([row.recipient, row.subject, row.body, row.transcript].every((v) => v === '' || isEncrypted(v))) continue
    totals.drafts++
    if (apply) {
      await sql.query('UPDATE drafts SET recipient = $2, subject = $3, body = $4, transcript = $5 WHERE id = $1 AND user_id = $6', [
        row.id,
        encryptText(user.id, 'drafts.recipient', row.recipient),
        encryptText(user.id, 'drafts.subject', row.subject),
        encryptText(user.id, 'drafts.body', row.body),
        encryptText(user.id, 'drafts.transcript', row.transcript),
        user.id,
      ])
    }
  }

  // Assistant conversations (the text and the record of what it did)
  const messages = (await sql.query('SELECT id, content, actions FROM assistant_messages WHERE user_id = $1', [user.id])) as {
    id: string
    content: string
    actions: unknown
  }[]
  for (const row of messages) {
    const actionsSealed = typeof row.actions === 'object' && row.actions !== null && 'enc' in row.actions
    const emptyActions = Array.isArray(row.actions) && row.actions.length === 0
    if (isEncrypted(row.content) && (actionsSealed || emptyActions)) continue
    totals.messages++
    if (apply) {
      await sql.query('UPDATE assistant_messages SET content = $2, actions = $3::jsonb WHERE id = $1 AND user_id = $4', [
        row.id,
        encryptText(user.id, 'assistant_messages.content', row.content),
        JSON.stringify(actionsSealed || emptyActions ? row.actions : encryptJson(user.id, 'assistant_messages.actions', row.actions)),
        user.id,
      ])
    }
  }

  // Agenda items
  const agenda = (await sql.query('SELECT id, title, notes FROM agenda_items WHERE user_id = $1', [user.id])) as {
    id: string
    title: string
    notes: string
  }[]
  for (const row of agenda) {
    if (isEncrypted(row.title) && (row.notes === '' || isEncrypted(row.notes))) continue
    totals.agenda++
    if (apply) {
      await sql.query('UPDATE agenda_items SET title = $2, notes = $3 WHERE id = $1 AND user_id = $4', [
        row.id,
        encryptText(user.id, 'agenda_items.title', row.title),
        encryptText(user.id, 'agenda_items.notes', row.notes),
        user.id,
      ])
    }
  }

  // Calendar link
  if (user.calendarUrl && !isEncrypted(user.calendarUrl)) {
    totals.calendars++
    if (apply) {
      await sql.query('UPDATE "user" SET "calendarUrl" = $2 WHERE id = $1', [user.id, encryptText('account-fields', 'user.calendarUrl', user.calendarUrl.trim())])
    }
  }
}

console.log(`${apply ? 'Converted' : 'Would convert (preview only)'} for ${users.length} account(s):`, totals)
