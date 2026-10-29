import { neon } from '@neondatabase/serverless'
import { decryptText } from '../netlify/functions/_lib/crypto.ts'

/**
 * Shows what a tester did, newest day first, so problems and their writing style can be understood.
 *
 *   node --env-file=.env.local scripts/activity-report.ts <email> [--days 7] [--full]
 *   node --env-file=.env.local scripts/activity-report.ts --list                      (who has a log)
 *   node --env-file=.env.local scripts/activity-report.ts <email> --delete            (erase their log for good)
 *
 * Only someone holding DATABASE_URL and DATA_ENCRYPTION_KEY (the owner) can read it. --full prints whole drafts.
 */
const args = process.argv.slice(2)
const sql = neon(process.env.DATABASE_URL ?? '')

if (args.includes('--list')) {
  const rows = await sql.query(
    'SELECT u.email, count(*)::int AS events, max(a.created_at) AS last FROM activity_log a JOIN "user" u ON u.id = a.user_id GROUP BY u.email ORDER BY last DESC',
  )
  console.table(rows)
  process.exit(0)
}

const email = args.find((a) => !a.startsWith('--') && a.includes('@'))
if (!email) {
  console.error('Give the tester email, or use --list.')
  process.exit(1)
}
const [user] = (await sql.query('SELECT id, name FROM "user" WHERE email = $1', [email])) as { id: string; name: string }[]
if (!user) {
  console.error('No account with that email.')
  process.exit(1)
}

if (args.includes('--delete')) {
  const gone = await sql.query('DELETE FROM activity_log WHERE user_id = $1 RETURNING id', [user.id])
  console.log(`Deleted ${gone.length} log entries for ${email}. Remove them from ACTIVITY_LOG_EMAILS in Netlify to stop new ones.`)
  process.exit(0)
}

const daysIndex = args.indexOf('--days')
const days = daysIndex >= 0 ? Number(args[daysIndex + 1]) || 7 : 7
const full = args.includes('--full')
const rows = (await sql.query(
  "SELECT kind, detail, created_at FROM activity_log WHERE user_id = $1 AND created_at > now() - ($2 || ' days')::interval ORDER BY created_at",
  [user.id, String(days)],
)) as { kind: string; detail: string; created_at: string | Date }[]

type Detail = Record<string, unknown>
const events = rows.map((row) => {
  let detail: Detail
  try {
    detail = JSON.parse(decryptText(user.id, 'activity', row.detail)) as Detail
  } catch {
    detail = { unreadable: true }
  }
  return { kind: row.kind, at: new Date(row.created_at), detail }
})

const clip = (value: unknown, max = full ? 4000 : 160): string => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > max ? `${text.slice(0, max)}…` : text
}
const time = (d: Date) => d.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', hour12: false })

console.log(`\n${user.name} <${email}> - last ${days} days, ${events.length} events (South African time)\n`)

const count = (kind: string) => events.filter((e) => e.kind === kind).length
console.log('SUMMARY')
console.log(`  app opens: ${count('session_start')}   recordings: ${count('transcribed')}   drafts written: ${count('draft_written')}   assistant turns: ${count('assistant_turn')}`)
console.log(`  problems: ${count('client_error') + count('draft_failed') + count('transcribe_failed') + count('transcribe_empty') + count('assistant_failed')}`)
const devices = new Set(events.filter((e) => e.kind === 'session_start').map((e) => `${e.detail.installed ? 'installed app' : 'browser'} | ${clip(e.detail.userAgent, 90)}`))
for (const device of devices) console.log(`  device: ${device}`)
const edited = events.filter((e) => e.kind === 'draft_action' && e.detail.edited)
console.log(`  actions on drafts: ${count('draft_action')} (${edited.length} after he changed the wording)\n`)

console.log('PROBLEMS')
const problems = events.filter((e) => ['client_error', 'draft_failed', 'transcribe_failed', 'transcribe_empty', 'assistant_failed'].includes(e.kind))
if (problems.length === 0) console.log('  none')
for (const e of problems) console.log(`  ${time(e.at)}  ${e.kind}  ${clip(e.detail)}`)

console.log('\nHIS WORDING CHANGES (first draft vs what he sent; shows his style)')
if (edited.length === 0) console.log('  none yet')
for (const e of edited) {
  console.log(`  ${time(e.at)}  ${String(e.detail.action)} -> ${clip(e.detail.recipient, 60)}`)
  console.log(`    first: ${clip(e.detail.firstBody ?? e.detail.body)}`)
  console.log(`    final: ${clip(e.detail.body)}`)
}

console.log('\nTIMELINE')
for (const e of events) {
  if (e.kind === 'screen') continue
  const d = e.detail
  const line =
    e.kind === 'transcribed' ? `said: ${clip(d.text)}`
    : e.kind === 'draft_written' ? `${String(d.category)} draft: ${clip((d.draft as Detail | undefined)?.body)}`
    : e.kind === 'assistant_turn' ? `said: ${clip(d.said)} | Apex: ${clip(d.reply)} | ${clip(d.actions)} | ${String(d.ms)}ms`
    : e.kind === 'draft_action' ? `${String(d.action)} (${String(d.category)})`
    : clip(d)
  console.log(`  ${time(e.at)}  ${e.kind.padEnd(18)} ${line}`)
}
