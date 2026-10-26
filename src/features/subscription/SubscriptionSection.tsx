import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Check, Sparkles } from 'lucide-react'
import { ApiRequestError, request } from '../../lib/api'
import { CURRENCIES, PLANS, type PlanChoice, type PlanId, type RatesResponse } from '../../types/plans'

const ratesSchema = z.object({
  base: z.literal('USD'),
  rates: z.record(z.string(), z.number()),
  asOf: z.string(),
  source: z.string(),
})
const choiceSchema = z.object({ choice: z.object({ plan: z.string(), currency: z.string() }).nullable() })

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

/** Plans and prices with live currency conversion. Shown only to accounts the feature has been released to. */
export function SubscriptionSection() {
  const [rates, setRates] = useState<RatesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState(defaultCurrency)
  const [choice, setChoice] = useState<PlanChoice | null>(null)
  const [saving, setSaving] = useState<PlanId | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([request('/api/rates', { method: 'GET' }), request('/api/plan', { method: 'GET' })])
      .then(([ratesBody, planBody]) => {
        if (cancelled) return
        const parsedRates = ratesSchema.safeParse(ratesBody)
        const parsedChoice = choiceSchema.safeParse(planBody)
        if (!parsedRates.success || !parsedChoice.success) throw new ApiRequestError(502, 'The server sent an unexpected response.')
        setRates(parsedRates.data)
        const saved = parsedChoice.data.choice as PlanChoice | null
        setChoice(saved)
        if (saved && parsedRates.data.rates[saved.currency]) setCurrency(saved.currency)
        else if (!parsedRates.data.rates[defaultCurrency()]) setCurrency('USD')
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'Could not load prices.'))
    return () => {
      cancelled = true
    }
  }, [])

  const available = useMemo(() => CURRENCIES.filter((c) => rates?.rates[c.code] !== undefined), [rates])
  const rate = rates?.rates[currency] ?? null

  const choose = async (plan: PlanId) => {
    setSaving(plan)
    try {
      const body = choiceSchema.safeParse(
        await request('/api/plan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, currency }) }),
      )
      if (body.success) setChoice(body.data.choice as PlanChoice | null)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save your choice.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section aria-labelledby="subscription-heading" className="mt-10">
      <h2 id="subscription-heading" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Sparkles className="size-6 text-fuchsia-400" aria-hidden="true" />
        Subscription
      </h2>
      <p className="muted mt-1 text-sm">
        Preview, visible only to your account. Billing isn't switched on yet, so choosing a plan only saves your choice.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      )}

      {!rates && !error && (
        <p role="status" className="muted mt-4">
          Loading prices…
        </p>
      )}

      {rates && rate !== null && (
        <>
          <div className="mt-4">
            <label htmlFor="plan-currency" className="mb-1.5 block text-sm font-semibold">
              Currency
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
              const selected = choice?.plan === plan.id
              return (
                <div key={plan.id} className={`surface flex flex-col gap-3 p-5 ${selected ? 'border-violet-400' : ''}`}>
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
                  <button
                    type="button"
                    onClick={() => void choose(plan.id)}
                    disabled={saving !== null || (selected && choice?.currency === currency)}
                    className={selected ? 'btn btn-ghost mt-auto' : 'btn btn-primary mt-auto'}
                  >
                    {selected && choice?.currency === currency ? 'Your choice' : saving === plan.id ? 'Saving…' : `Choose ${plan.name}`}
                  </button>
                </div>
              )
            })}
          </div>

          <p className="muted mt-3 text-xs">
            {currency === 'USD'
              ? 'Prices are in US dollars.'
              : `1 USD = ${rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${currency}. Rates from ${rates.source}, ${rates.asOf}, updated daily. Your bank's rate may differ slightly.`}
          </p>
        </>
      )}
    </section>
  )
}
