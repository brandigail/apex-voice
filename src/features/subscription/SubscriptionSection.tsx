import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Check, FlaskConical, Sparkles } from 'lucide-react'
import { ApiRequestError, request } from '../../lib/api'
import { CURRENCIES, PLANS, type PlanId, type RatesResponse } from '../../types/plans'
import type { SubscriptionResponse } from '../../types/subscription'

const ratesSchema = z.object({
  base: z.literal('USD'),
  rates: z.record(z.string(), z.number()),
  asOf: z.string(),
  source: z.string(),
})
const subscriptionSchema = z.object({
  subscription: z
    .object({
      plan: z.enum(['basic', 'pro']),
      status: z.enum(['pending', 'active', 'cancelled']),
      amountZar: z.number(),
      displayCurrency: z.string(),
      lastPaymentAt: z.string().nullable(),
      nextBillingAt: z.string().nullable(),
    })
    .nullable(),
  testMode: z.boolean(),
})
const checkoutSchema = z.object({ action: z.url(), fields: z.record(z.string(), z.string()) })

const POLL_MS = 2_500
const POLL_FOR_MS = 40_000

/** Guesses a sensible starting currency from the phone's region, for example en-ZA starts on rand. */
function defaultCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    const byRegion: Record<string, string> = {
      ZA: 'ZAR', NA: 'NAD', BW: 'BWP', NG: 'NGN', KE: 'KES', GB: 'GBP', AU: 'AUD', CA: 'CAD', NZ: 'NZD', AE: 'AED', IN: 'INR',
      DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', IE: 'EUR',
    }
    return (region && byRegion[region]) || 'USD'
  } catch {
    return 'USD'
  }
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount)
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** What the page address says about a payment the user just came back from, read once on load. */
function paymentResult(): 'success' | 'cancelled' | null {
  const value = new URLSearchParams(window.location.search).get('payment')
  return value === 'success' || value === 'cancelled' ? value : null
}

/** Sends the browser to PayFast by posting the signed fields it gave us, which is how PayFast checkout works. */
function submitToPayfast(action: string, fields: Record<string, string>): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}

/** Plans and prices with live currency conversion, and PayFast checkout. Shown only to accounts the feature has been released to. */
export function SubscriptionSection() {
  const [rates, setRates] = useState<RatesResponse | null>(null)
  const [state, setState] = useState<SubscriptionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState(defaultCurrency)
  const [busy, setBusy] = useState<PlanId | 'cancel' | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [returned] = useState(paymentResult)
  const [waiting, setWaiting] = useState(returned === 'success')

  const fetchSubscription = useCallback(async (): Promise<SubscriptionResponse> => {
    const parsed = subscriptionSchema.safeParse(await request('/api/subscription', { method: 'GET' }))
    if (!parsed.success) throw new ApiRequestError(502, 'The server sent an unexpected response.')
    return parsed.data as SubscriptionResponse
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([request('/api/rates', { method: 'GET' }), fetchSubscription()])
      .then(([ratesBody, latest]) => {
        if (cancelled) return
        const parsedRates = ratesSchema.safeParse(ratesBody)
        if (!parsedRates.success) throw new ApiRequestError(502, 'The server sent an unexpected response.')
        setRates(parsedRates.data)
        setState(latest)
        if (!parsedRates.data.rates[defaultCurrency()]) setCurrency('USD')
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'Could not load prices.'))
    return () => {
      cancelled = true
    }
  }, [fetchSubscription])

  // Tidy the "?payment=success" from the address so a refresh doesn't repeat the message.
  useEffect(() => {
    if (returned) window.history.replaceState(null, '', window.location.pathname)
  }, [returned])

  // PayFast confirms a payment to our server a moment after sending the buyer back, so wait for that to arrive.
  useEffect(() => {
    if (!waiting) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      fetchSubscription()
        .then((latest) => {
          setState(latest)
          if (latest.subscription?.status === 'active' || Date.now() - startedAt > POLL_FOR_MS) setWaiting(false)
        })
        .catch(() => setWaiting(false))
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waiting, fetchSubscription])

  const available = useMemo(() => CURRENCIES.filter((c) => rates?.rates[c.code] !== undefined), [rates])
  const rate = rates?.rates[currency] ?? null
  const zarRate = rates?.rates.ZAR ?? null
  const subscription = state?.subscription ?? null
  const active = subscription?.status === 'active'

  const subscribe = async (plan: PlanId) => {
    setBusy(plan)
    setError(null)
    try {
      const body = checkoutSchema.safeParse(
        await request('/api/subscription/checkout', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, currency }) }),
      )
      if (!body.success) throw new ApiRequestError(502, 'The server sent an unexpected response.')
      submitToPayfast(body.data.action, body.data.fields)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start the payment.')
      setBusy(null)
    }
  }

  const cancel = async () => {
    setBusy('cancel')
    setError(null)
    try {
      await request('/api/subscription/cancel', { method: 'POST' })
      setState(await fetchSubscription())
      setConfirmCancel(false)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not cancel the subscription.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="subscription-heading" className="mt-10">
      <h2 id="subscription-heading" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Sparkles className="size-6 text-fuchsia-400" aria-hidden="true" />
        Subscription
      </h2>
      <p className="muted mt-1 text-sm">Preview, visible only to your account.</p>

      {state?.testMode && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Test mode. You pay on PayFast's practice site, so no real money moves.
        </p>
      )}

      {returned === 'cancelled' && (
        <p role="status" className="mt-3 rounded-xl border border-(--line) bg-(--surface) p-3 text-sm">
          The payment was cancelled. Nothing was charged.
        </p>
      )}
      {waiting && (
        <p role="status" className="mt-3 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3 text-sm">
          Thanks! Waiting for PayFast to confirm your payment…
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      )}

      {!rates && !error && (
        <p role="status" className="muted mt-4">
          Loading…
        </p>
      )}

      {active && subscription && (
        <div className="surface mt-4 flex flex-col gap-2 border-emerald-500/50 p-5">
          <p className="flex items-center gap-2 font-bold text-emerald-500">
            <Check className="size-5" aria-hidden="true" />
            Subscribed to {PLANS.find((p) => p.id === subscription.plan)?.name}
          </p>
          <p className="text-sm">
            {money(subscription.amountZar, 'ZAR')} every month, billed in rand.
            {subscription.nextBillingAt && <> Next payment around {dateFormat.format(new Date(subscription.nextBillingAt))}.</>}
          </p>
          {confirmCancel ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void cancel()} disabled={busy === 'cancel'} className="btn border border-red-600 bg-red-600 text-white hover:bg-red-700">
                {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel it'}
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="btn btn-ghost">
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmCancel(true)} className="btn btn-ghost mt-2 self-start">
              Cancel subscription
            </button>
          )}
        </div>
      )}

      {!active && rates && rate !== null && zarRate !== null && (
        <>
          {subscription?.status === 'cancelled' && <p className="muted mt-3 text-sm">Your last subscription was cancelled. You can subscribe again below.</p>}
          <div className="mt-4">
            <label htmlFor="plan-currency" className="mb-1.5 block text-sm font-semibold">
              Show prices in
            </label>
            <select id="plan-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
              {available.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const zar = Math.round(plan.usdPerMonth * zarRate * 100) / 100
              return (
                <div key={plan.id} className="surface flex flex-col gap-3 p-5">
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="mt-1 text-3xl font-extrabold tracking-tight">
                      {money(plan.usdPerMonth * rate, currency)}
                      <span className="muted text-base font-medium"> / month</span>
                    </p>
                    {currency !== 'USD' && (
                      <p className="muted text-xs">
                        {money(plan.usdPerMonth, 'USD')} × {rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                    )}
                  </div>
                  <ul className="muted space-y-1 text-sm">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => void subscribe(plan.id)} disabled={busy !== null} className="btn btn-primary mt-auto">
                    {busy === plan.id ? 'Opening PayFast…' : `Subscribe with PayFast`}
                  </button>
                  <p className="muted text-xs">PayFast bills in rand: {money(zar, 'ZAR')} each month, set at today's rate.</p>
                </div>
              )
            })}
          </div>

          <p className="muted mt-3 text-xs">
            {currency === 'USD' ? 'Prices are in US dollars.' : `1 USD = ${rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${currency}.`} Rates
            from {rates.source}, {rates.asOf}, updated daily. Your bank's rate may differ slightly.
          </p>
        </>
      )}
    </section>
  )
}
