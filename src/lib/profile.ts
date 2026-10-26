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

/** The sign-off appended to emails and quotes: the custom one if set, otherwise built from the profile. */
export function buildSignature(profile: Profile): string {
  if (profile.signature) return profile.signature
  const organisation = [profile.role, profile.businessName].filter(Boolean).join(', ')
  return ['Kind regards,', profile.name, organisation, profile.phone].filter(Boolean).join('\n')
}
