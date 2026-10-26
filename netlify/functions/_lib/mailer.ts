import { describeError, describeUpstream } from './safe-log.ts'
const RESEND_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Apex Voice <onboarding@resend.dev>'

export interface Email {
  to: string
  subject: string
  text: string
}

export type MailResult = { sent: true } | { sent: false; reason: string }

/**
 * Sends one email through Resend (free tier, no card). Needs RESEND_API_KEY. Until the sending domain is verified in
 * Resend, it only delivers to the Resend account owner's own address, which is enough for testing. Never throws.
 */
export async function sendEmail(email: Email): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Email not sent: RESEND_API_KEY is not set')
    return { sent: false, reason: 'Email is not configured.' }
  }
  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || DEFAULT_FROM, to: [email.to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      console.error('Resend rejected the email:', await describeUpstream(response))
      return { sent: false, reason: `The email service answered ${response.status}.` }
    }
    return { sent: true }
  } catch (err) {
    console.error('Email request failed:', describeError(err))
    return { sent: false, reason: 'The email service could not be reached.' }
  }
}
