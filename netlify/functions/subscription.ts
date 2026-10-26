import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { CURRENCIES, PLANS, type PlanId } from '../../src/types/plans.ts'
import type { CheckoutResponse, Subscription, SubscriptionResponse } from '../../src/types/subscription.ts'
import { featuresFor } from './_lib/features.ts'
import { errorResponse, json } from './_lib/http.ts'
import { apiHeaders, payfastConfig, signedCheckoutFields } from './_lib/payfast.ts'
import { getRates } from './_lib/rates.ts'
import { requireUser } from './_lib/session.ts'

interface SubscriptionRow {
  plan: PlanId
  status: Subscription['status']
  amount_zar: string
  display_currency: string
  pf_token: string | null
  last_payment_at: string | Date | null
  next_billing_at: string | Date | null
}

const COLUMNS = 'plan, status, amount_zar, display_currency, pf_token, last_payment_at, next_billing_at'

const checkoutSchema = z.object({
  plan: z.enum(PLANS.map((plan) => plan.id) as [PlanId, ...PlanId[]]),
  currency: z.enum(CURRENCIES.map((currency) => currency.code) as [string, ...string[]]),
})

const iso = (value: string | Date | null): string | null => (value ? new Date(value).toISOString() : null)

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    plan: row.plan,
    status: row.status,
    amountZar: Number(row.amount_zar),
    displayCurrency: row.display_currency,
    lastPaymentAt: iso(row.last_payment_at),
    nextBillingAt: iso(row.next_billing_at),
  }
}

/** The public address of this site, which PayFast needs to send the buyer back and to post payment notifications to. */
function siteUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? process.env.URL ?? '').replace(/\/$/, '')
}

/** Routes: GET /api/subscription, POST /api/subscription/checkout, POST /api/subscription/cancel. */
function actionFrom(req: Request): string | null {
  const [, , action] = new URL(req.url).pathname.split('/').filter(Boolean)
  return action?.replace(/\.html?$/, '') ?? null
}

export default async function handler(req: Request): Promise<Response> {
  const session = await requireUser(req)
  if (!session.ok) return session.response
  if (!featuresFor(session.user.email).subscriptions) return errorResponse(404, 'Not found.')

  const config = payfastConfig()
  const sql = neon(process.env.DATABASE_URL ?? '')
  const action = actionFrom(req)

  try {
    if (req.method === 'GET' && action === null) {
      const [row] = (await sql.query(`SELECT ${COLUMNS} FROM subscriptions WHERE user_id = $1`, [session.user.id])) as SubscriptionRow[]
      return json<SubscriptionResponse>({ subscription: row ? toSubscription(row) : null, testMode: !config.live })
    }

    if (req.method === 'POST' && action === 'checkout') return await checkout(req, sql, session.user, config)
    if (req.method === 'POST' && action === 'cancel') return await cancel(sql, session.user.id, config)
    return errorResponse(405, 'Method not allowed.')
  } catch (err) {
    console.error('Subscription request failed:', err)
    return errorResponse(500, 'Could not reach your subscription. Please try again.')
  }
}

async function checkout(
  req: Request,
  sql: NeonQueryFunction<false, false>,
  user: { id: string; email: string; profile: { name: string } },
  config: ReturnType<typeof payfastConfig>,
): Promise<Response> {
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return errorResponse(400, 'Pick a plan and a currency from the list.')
  const plan = PLANS.find((p) => p.id === parsed.data.plan)
  if (!plan) return errorResponse(400, 'Unknown plan.')

  const [existing] = (await sql.query('SELECT status FROM subscriptions WHERE user_id = $1', [user.id])) as { status: string }[]
  if (existing?.status === 'active') return errorResponse(409, 'You already have an active subscription. Cancel it first to change plan.')

  // PayFast bills in rand only, so the price in any other currency is converted to rand at today's rate and fixed at that amount.
  const rates = await getRates()
  const zarRate = rates?.rates.ZAR
  if (!zarRate) return errorResponse(502, 'Exchange rates are unavailable right now. Please try again shortly.')
  const amountZar = (Math.round(plan.usdPerMonth * zarRate * 100) / 100).toFixed(2)

  const base = siteUrl()
  if (!base) return errorResponse(500, 'The site address is not configured.')
  const mPaymentId = crypto.randomUUID()
  await sql.query(
    `INSERT INTO subscriptions (user_id, plan, status, amount_zar, display_currency, m_payment_id)
     VALUES ($1, $2, 'pending', $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'pending', amount_zar = EXCLUDED.amount_zar,
       display_currency = EXCLUDED.display_currency, m_payment_id = EXCLUDED.m_payment_id, pf_token = NULL, updated_at = now()`,
    [user.id, plan.id, amountZar, parsed.data.currency, mPaymentId],
  )

  const [first = '', ...rest] = user.profile.name.trim().split(/\s+/)
  const fields = signedCheckoutFields(
    {
      merchant_id: config.merchantId,
      merchant_key: config.merchantKey,
      return_url: `${base}/?payment=success`,
      cancel_url: `${base}/?payment=cancelled`,
      notify_url: `${base}/api/payfast-notify`,
      name_first: first,
      name_last: rest.join(' '),
      email_address: user.email,
      m_payment_id: mPaymentId,
      amount: amountZar,
      item_name: `Apex Voice ${plan.name}`,
      item_description: 'Monthly subscription',
      subscription_type: '1',
      billing_date: new Date().toISOString().slice(0, 10),
      recurring_amount: amountZar,
      frequency: '3',
      cycles: '0',
    },
    config,
  )
  return json<CheckoutResponse>({ action: config.processUrl, fields })
}

async function cancel(sql: NeonQueryFunction<false, false>, userId: string, config: ReturnType<typeof payfastConfig>): Promise<Response> {
  const [row] = (await sql.query("SELECT pf_token FROM subscriptions WHERE user_id = $1 AND status = 'active'", [userId])) as {
    pf_token: string | null
  }[]
  if (!row) return errorResponse(404, 'You have no active subscription.')
  if (!row.pf_token) return errorResponse(409, 'This subscription has no PayFast token yet. Try again in a minute.')

  const url = `${config.apiUrl}/subscriptions/${encodeURIComponent(row.pf_token)}/cancel${config.live ? '' : '?testing=true'}`
  const response = await fetch(url, { method: 'PUT', headers: apiHeaders(config), signal: AbortSignal.timeout(8_000) })
  if (!response.ok) {
    console.error('PayFast cancel failed:', response.status, (await response.text().catch(() => '')).slice(0, 300))
    return errorResponse(502, 'PayFast would not cancel the subscription. Please try again.')
  }
  await sql.query("UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE user_id = $1", [userId])
  return json({ cancelled: true })
}

export const config: Config = { path: ['/api/subscription', '/api/subscription/*'] }
