export type PlanId = 'basic' | 'pro'

export interface Plan {
  id: PlanId
  name: string
  /** Price per month in US dollars; every other currency is converted from this. */
  usdPerMonth: number
  perks: readonly string[]
}

export interface RatesResponse {
  base: 'USD'
  /** Units of each currency that one US dollar buys. */
  rates: Record<string, number>
  /** The day the rates were published. */
  asOf: string
  source: string
}

export interface PlanChoice {
  plan: PlanId
  currency: string
}

export interface Currency {
  code: string
  name: string
}

/** Currencies offered in the picker. A currency whose rate can't be fetched is simply left out. */
export const CURRENCIES: readonly Currency[] = [
  { code: 'USD', name: 'US dollar' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'NAD', name: 'Namibian dollar' },
  { code: 'BWP', name: 'Botswana pula' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'KES', name: 'Kenyan shilling' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'INR', name: 'Indian rupee' },
]

export const PLANS: readonly Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    usdPerMonth: 5,
    perks: ['Voice notes to email, quote, WhatsApp, SMS and social posts', 'Hands-free assistant with daily limits', 'Draft history and agenda'],
  },
  {
    id: 'pro',
    name: 'Pro',
    usdPerMonth: 10,
    perks: ['Everything in Basic', 'Higher daily assistant limits (planned, not enforced yet)'],
  },
]
