import type { Features } from '../../../src/types/features.ts'
import { isLogged } from './activity.ts'

/**
 * Which features a user may see. `FEATURE_SUBSCRIPTIONS` is "all" (released to everyone), "off", or a comma separated
 * list of account emails that get a preview. Unset means nobody, so a feature never leaks by accident.
 */
function enabledFor(setting: string | undefined, email: string): boolean {
  const value = (setting ?? '').trim().toLowerCase()
  if (value === 'all') return true
  return value.split(',').map((entry) => entry.trim()).filter(Boolean).includes(email.toLowerCase())
}

export function featuresFor(email: string): Features {
  return { subscriptions: enabledFor(process.env.FEATURE_SUBSCRIPTIONS, email), activityLogged: isLogged(email) }
}
