import { neon } from '@neondatabase/serverless'
import { openText } from './_lib/crypto.ts'
import { errorResponse } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { describeError } from './_lib/safe-log.ts'
import { requireUser } from './_lib/session.ts'

interface DraftRow {
  id: string
  category: string
  recipient: string
  subject: string
  body: string
  transcript: string
  language: string
  created_at: string | Date
  sent_at: string | Date | null
  send_at: string | Date | null
}

interface MessageRow {
  conversation_id: string
  role: string
  content: string
  created_at: string | Date
}

interface AgendaRow {
  title: string
  starts_at: string | Date
  ends_at: string | Date | null
  notes: string
}

const iso = (value: string | Date | null) => (value ? new Date(value).toISOString() : null)

/** Everything Apex holds about the signed-in person, opened and handed back as one file they can keep. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errorResponse(405, 'Method not allowed.')
  const session = await requireUser(req)
  if (!session.ok) return session.response
  const { id: userId, email, profile } = session.user

  const quota = await claimQuota(userId, 'export')
  if (!quota.ok) return quota.response

  try {
    const sql = neon(process.env.DATABASE_URL ?? '')
    const [drafts, messages, agenda, feedback, subscription] = await Promise.all([
      sql.query(
        'SELECT id, category, recipient, subject, body, transcript, language, created_at, sent_at, send_at FROM drafts WHERE user_id = $1 ORDER BY created_at',
        [userId],
      ) as unknown as Promise<DraftRow[]>,
      sql.query('SELECT conversation_id, role, content, created_at FROM assistant_messages WHERE user_id = $1 ORDER BY id', [userId]) as unknown as Promise<MessageRow[]>,
      sql.query('SELECT title, starts_at, ends_at, notes FROM agenda_items WHERE user_id = $1 ORDER BY starts_at', [userId]) as unknown as Promise<AgendaRow[]>,
      sql.query('SELECT message, screen, created_at FROM feedback WHERE user_id = $1 ORDER BY created_at', [userId]) as unknown as Promise<
        { message: string; screen: string; created_at: string | Date }[]
      >,
      sql.query('SELECT plan, status, amount_zar, last_payment_at FROM subscriptions WHERE user_id = $1', [userId]) as unknown as Promise<
        { plan: string; status: string; amount_zar: string; last_payment_at: string | Date | null }[]
      >,
    ])

    const data = {
      exportedAt: new Date().toISOString(),
      note: 'Everything Apex Voice stores about you. Voice recordings are never stored.',
      account: { email, name: profile.name, businessName: profile.businessName, role: profile.role, phone: profile.phone, signature: profile.signature, calendarLinked: profile.calendarUrl !== '' },
      drafts: drafts.map((d) => ({
        id: d.id,
        type: d.category,
        language: d.language,
        to: openText(userId, 'drafts.recipient', d.recipient),
        subject: openText(userId, 'drafts.subject', d.subject),
        message: openText(userId, 'drafts.body', d.body),
        whatWasSaid: openText(userId, 'drafts.transcript', d.transcript),
        createdAt: iso(d.created_at),
        markedSentAt: iso(d.sent_at),
        plannedSendAt: iso(d.send_at),
      })),
      assistantConversations: messages.map((m) => ({
        conversationId: m.conversation_id,
        who: m.role,
        text: openText(userId, 'assistant_messages.content', m.content),
        at: iso(m.created_at),
      })),
      agenda: agenda.map((a) => ({
        title: openText(userId, 'agenda_items.title', a.title),
        notes: openText(userId, 'agenda_items.notes', a.notes),
        starts: iso(a.starts_at),
        ends: iso(a.ends_at),
      })),
      feedbackYouSent: feedback.map((f) => ({ message: f.message, screen: f.screen, at: iso(f.created_at) })),
      subscription: subscription.map((s) => ({ plan: s.plan, status: s.status, amountZar: Number(s.amount_zar), lastPaymentAt: iso(s.last_payment_at) })),
    }

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="apex-voice-my-data.json"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Data export failed:', describeError(err))
    return errorResponse(500, 'Could not prepare your data. Please try again.')
  }
}
