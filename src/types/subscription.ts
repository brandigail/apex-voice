import type { PlanId } from './plans.ts'

export type SubscriptionStatus = 'pending' | 'active' | 'cancelled'

/** The signed-in user's subscription, as the screen needs it. */
export interface Subscription {
  plan: PlanId
  status: SubscriptionStatus
  /** What PayFast charges each month. PayFast bills in rand only, whatever currency the price was shown in. */
  amountZar: number
  /** The currency the user picked when choosing the plan. */
  displayCurrency: string
  lastPaymentAt: string | null
  nextBillingAt: string | null
}

export interface SubscriptionResponse {
  subscription: Subscription | null
  /** True while PayFast's sandbox is in use, so the screen can say no real money moves. */
  testMode: boolean
}

/** What the browser must POST to PayFast to start a payment. */
export interface CheckoutResponse {
  action: string
  fields: Record<string, string>
}
