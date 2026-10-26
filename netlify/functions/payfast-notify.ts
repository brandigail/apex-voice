import { neon } from '@neondatabase/serverless'
import type { Config } from '@netlify/functions'
import { sendEmail } from './_lib/mailer.ts'
import { isPayfastAddress, itnSignatureIsValid, payfastConfirmsItn, payfastConfig } from './_lib/payfast.ts'
import { PLANS } from '../../src/types/plans.ts'

interface SubscriptionRow {
  user_id: string
  plan: string
  amount_zar: string
  display_currency: string
  email: string
  name: string
}

const ok = () => new Response('OK', { status: 200 })
const rejected = (reason: string) => {
  console.error('PayFast notification rejected:', reason)
  return new Response('Rejected', { status: 400 })
}

const money = (value: number) => `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * PayFast posts here after every payment (the "ITN"). Nothing is believed until the signature matches, the amount is the
 * one we asked for, and PayFast itself confirms it sent the notification.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const config = payfastConfig()

  const entries = [...new URLSearchParams(await req.text()).entries()] as [string, string][]
  const data = Object.fromEntries(entries)

  // Real payments must come from PayFast's own servers. The sandbox is checked by the steps below but not by address.
  const ip = req.headers.get('x-nf-client-connection-ip')
  if (config.live && !isPayfastAddress(ip)) return rejected(`unexpected sender ${ip ?? 'unknown'}`)
  if (!itnSignatureIsValid(entries, config)) return rejected('bad signature')

  const sql = neon(process.env.DATABASE_URL ?? '')
  const mPaymentId = data.m_payment_id
  if (!mPaymentId || !/^[0-9a-f-]{36}$/i.test(mPaymentId)) return rejected('missing payment id')

  const [subscription] = (await sql.query(
    `SELECT s.user_id, s.plan, s.amount_zar, s.display_currency, u.email, u.name
     FROM subscriptions s JOIN "user" u ON u.id = s.user_id WHERE s.m_payment_id = $1`,
    [mPaymentId],
  )) as SubscriptionRow[]
  if (!subscription) return rejected('unknown payment id')

  const paid = Number(data.amount_gross)
  if (!Number.isFinite(paid) || Math.abs(paid - Number(subscription.amount_zar)) > 0.01) return rejected(`amount ${data.amount_gross} does not match`)
  if (!(await payfastConfirmsItn(entries, config))) return rejected('PayFast did not confirm the notification')

  const status = data.payment_status
  if (status === 'COMPLETE') {
    const pfPaymentId = data.pf_payment_id
    if (!pfPaymentId) return rejected('missing pf_payment_id')
    const inserted = await sql.query(
      `INSERT INTO payments (pf_payment_id, user_id, m_payment_id, amount_gross, status)
       VALUES ($1, $2, $3, $4, 'COMPLETE') ON CONFLICT (pf_payment_id) DO NOTHING RETURNING pf_payment_id`,
      [pfPaymentId, subscription.user_id, mPaymentId, paid],
    )
    await sql.query(
      `UPDATE subscriptions SET status = 'active', pf_token = COALESCE($2, pf_token), last_payment_at = now(),
         next_billing_at = now() + interval '1 month', updated_at = now() WHERE user_id = $1`,
      [subscription.user_id, data.token || null],
    )

    // PayFast repeats a notification until it gets a 200, so only the first copy of a payment sends the email.
    if (inserted.length > 0) {
      const plan = PLANS.find((p) => p.id === subscription.plan)
      const sandbox = config.live ? '' : ' This was a TEST payment: no real money was taken.'
      const result = await sendEmail({
        to: subscription.email,
        subject: `Your Apex Voice ${plan?.name ?? ''} subscription is active`.replace('  ', ' '),
        text: [
          `Hi ${subscription.name.trim().split(/\s+/)[0] || 'there'},`,
          '',
          `Thank you! We received your payment of ${money(paid)} for Apex Voice ${plan?.name ?? 'subscription'}.${sandbox}`,
          '',
          `Reference: ${pfPaymentId}`,
          'Your plan renews every month. You can cancel any time in Apex Voice, under Profile, Subscription.',
          '',
          'Apex Voice',
        ].join('\n'),
      })
      await sql.query('UPDATE payments SET emailed = $2 WHERE pf_payment_id = $1', [pfPaymentId, result.sent])
    }
  } else if (status === 'CANCELLED') {
    await sql.query("UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE user_id = $1", [subscription.user_id])
  }
  return ok()
}

export const config: Config = { path: '/api/payfast-notify' }
