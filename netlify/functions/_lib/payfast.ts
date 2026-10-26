import { createHash } from 'node:crypto'
import { describeError } from './safe-log.ts'

/** PayFast's public sandbox merchant. Anyone can use it to test; no real money moves and nothing needs signing up for. */
const SANDBOX_MERCHANT_ID = '10000100'
const SANDBOX_MERCHANT_KEY = '46f0cd694581a'

export interface PayfastConfig {
  /** False while testing against PayFast's sandbox. */
  live: boolean
  merchantId: string
  merchantKey: string
  /** Optional security passphrase set in the PayFast dashboard; part of every signature when present. */
  passphrase: string
  /**
   * False only for PayFast's shared public test merchant, which has a passphrase we are not told, so no signature we
   * make can match. Requests to it go unsigned (the sandbox accepts that) and each payment is still confirmed with
   * PayFast's servers. Any merchant of your own, and every live payment, is always signed.
   */
  signRequests: boolean
  processUrl: string
  validateUrl: string
  apiUrl: string
}

/** `PAYFAST_MODE=live` switches to real payments with the merchant details from the environment; anything else is the sandbox. */
export function payfastConfig(): PayfastConfig {
  const live = process.env.PAYFAST_MODE === 'live'
  const host = live ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za'
  return {
    live,
    merchantId: process.env.PAYFAST_MERCHANT_ID || (live ? '' : SANDBOX_MERCHANT_ID),
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || (live ? '' : SANDBOX_MERCHANT_KEY),
    passphrase: process.env.PAYFAST_PASSPHRASE ?? '',
    signRequests: live || Boolean(process.env.PAYFAST_MERCHANT_ID),
    processUrl: `${host}/eng/process`,
    validateUrl: `${host}/eng/query/validate`,
    apiUrl: 'https://api.payfast.co.za',
  }
}

/** PayFast signs values encoded like PHP's urlencode: spaces as "+", and the characters !'()* escaped too. */
function encode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** The "key=value&key=value" string PayFast signs, from fields already in PayFast's required order. Empty values are left out. */
export function parameterString(pairs: readonly (readonly [string, string])[], passphrase = ''): string {
  const parts = pairs.filter(([, value]) => value.trim() !== '').map(([key, value]) => `${key}=${encode(value)}`)
  if (passphrase) parts.push(`passphrase=${encode(passphrase)}`)
  return parts.join('&')
}

export function signature(pairs: readonly (readonly [string, string])[], passphrase = ''): string {
  return createHash('md5').update(parameterString(pairs, passphrase)).digest('hex')
}

/** The order PayFast expects checkout fields in; the signature depends on it. */
const FIELD_ORDER = [
  'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url', 'notify_method',
  'name_first', 'name_last', 'email_address', 'cell_number',
  'm_payment_id', 'amount', 'item_name', 'item_description',
  'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
  'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
  'email_confirmation', 'confirmation_address', 'currency', 'payment_method',
  'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles',
] as const

/** Puts the checkout fields in PayFast's order and appends the signature. */
export function signedCheckoutFields(fields: Record<string, string>, config: PayfastConfig): Record<string, string> {
  const ordered: [string, string][] = FIELD_ORDER.filter((key) => fields[key] !== undefined && fields[key] !== '').map((key) => [key, fields[key]])
  if (!config.signRequests) return Object.fromEntries(ordered)
  return { ...Object.fromEntries(ordered), signature: signature(ordered, config.passphrase) }
}

/** Checks the signature on a payment notification (ITN) exactly as PayFast documents it. */
export function itnSignatureIsValid(entries: readonly (readonly [string, string])[], config: PayfastConfig): boolean {
  if (!config.signRequests) return true // the shared test merchant's notifications are signed with a passphrase we don't have
  const received = entries.find(([key]) => key === 'signature')?.[1]
  if (!received) return false
  const withoutSignature = entries.filter(([key]) => key !== 'signature')
  return signature(withoutSignature, config.passphrase) === received
}

/** Asks PayFast whether it really sent this notification. Returns true only for an explicit "VALID". */
export async function payfastConfirmsItn(entries: readonly (readonly [string, string])[], config: PayfastConfig): Promise<boolean> {
  const body = parameterString(entries.filter(([key]) => key !== 'signature'))
  try {
    const response = await fetch(config.validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(6_000),
    })
    return (await response.text()).trim() === 'VALID'
  } catch (err) {
    console.error('PayFast validation request failed:', describeError(err))
    return false
  }
}

/** PayFast's published server addresses, for rejecting notifications that did not come from them. */
const PAYFAST_RANGES: readonly [string, number][] = [
  ['197.97.145.144', 28],
  ['41.74.179.192', 27],
  ['102.216.36.0', 28],
  ['102.216.36.128', 28],
  ['144.126.193.139', 32],
]

function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

export function isPayfastAddress(ip: string | null): boolean {
  const value = ip ? ipToInt(ip.trim()) : null
  if (value === null) return false
  return PAYFAST_RANGES.some(([base, bits]) => {
    const start = ipToInt(base) as number
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) === (start & mask)
  })
}

/** Headers PayFast's REST API (used here to cancel a subscription) requires; the signature covers them in alphabetical order. */
export function apiHeaders(config: PayfastConfig): Record<string, string> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00')
  const pairs: [string, string][] = [
    ['merchant-id', config.merchantId],
    ['timestamp', timestamp],
    ['version', 'v1'],
  ]
  return {
    'merchant-id': config.merchantId,
    version: 'v1',
    timestamp,
    signature: signature(pairs, config.passphrase),
  }
}
