import { PROFILE_LIMITS, type Profile, type ProfileSource } from '../types/profile.ts'

// Shared by the client and the Netlify Functions. Keep this file free of DOM and Node APIs.

function clean(value: string | null | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max)
}

/** Normalises a stored user into a Profile: nulls become empty strings and values are trimmed and length-capped. */
export function profileFromUser(user: ProfileSource): Profile {
  return {
    name: clean(user.name, PROFILE_LIMITS.name),
    businessName: clean(user.businessName, PROFILE_LIMITS.businessName),
    role: clean(user.role, PROFILE_LIMITS.role),
    phone: clean(user.phone, PROFILE_LIMITS.phone),
    signature: clean(user.signature, PROFILE_LIMITS.signature),
    calendarUrl: clean(user.calendarUrl, PROFILE_LIMITS.calendarUrl),
  }
}

/** The polite closing line for each language a draft can be written in; English is used for any other. */
const CLOSINGS: Record<string, string> = {
  en: 'Kind regards,',
  af: 'Vriendelike groete,',
  es: 'Saludos cordiales,',
  fr: 'Cordialement,',
  de: 'Mit freundlichen Grüßen,',
  pt: 'Atenciosamente,',
  nl: 'Met vriendelijke groet,',
  it: 'Cordiali saluti,',
  sw: 'Wako mwaminifu,',
  zu: 'Ozithobayo,',
  xh: 'Ozithobileyo,',
}

/** The closing phrases in {@link CLOSINGS}, lower case without punctuation, so a sign-off written by the model can be recognised. */
export const CLOSING_PHRASES: readonly string[] = Object.values(CLOSINGS).map((c) => c.replace(/,$/, '').toLowerCase())

/** The sign-off appended to emails and quotes: the custom one if set, otherwise built from the profile. */
export function buildSignature(profile: Profile, language = 'en'): string {
  if (profile.signature) return profile.signature
  const organisation = [profile.role, profile.businessName].filter(Boolean).join(', ')
  return [CLOSINGS[language] ?? CLOSINGS.en, profile.name, organisation, profile.phone].filter(Boolean).join('\n')
}
