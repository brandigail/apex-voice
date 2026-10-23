import { buildSignature } from '../../../src/lib/profile.ts'
import type { GeneratedDraft } from '../../../src/types/draft.ts'
import type { Profile } from '../../../src/types/profile.ts'

const CLOSING_LINE =
  /^(best regards|kind regards|warm regards|many thanks|thanks|thank you|regards|sincerely|yours (?:sincerely|faithfully|truly)|cheers|best wishes|best)[,.!]?$/i

/** A short line after the closing phrase is almost certainly the sender's name, not content. */
const MAX_NAME_LINE_LENGTH = 40

/**
 * Removes a sign-off the model wrote at the end of the body (a closing phrase such as "Best regards," plus
 * an optional name line), because the user's own signature is appended instead. Only whole lines that are
 * just a closing phrase are removed, so "Thank you for the prompt payment." is kept.
 */
export function stripSignOff(body: string): string {
  const lines = body.trimEnd().split('\n')
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    if (!CLOSING_LINE.test(lines[i].trim())) continue
    const trailing = lines.slice(i + 1).map((l) => l.trim()).filter(Boolean)
    if (trailing.length > 1 || (trailing[0]?.length ?? 0) > MAX_NAME_LINE_LENGTH) continue
    return lines.slice(0, i).join('\n').trimEnd()
  }
  return body.trimEnd()
}

/** Emails and quotes get the sender's signature appended; texts and notes don't. */
export function withSignature(draft: GeneratedDraft, profile: Profile): GeneratedDraft {
  if (draft.category !== 'EMAIL' && draft.category !== 'QUOTE') return draft
  return { ...draft, body: `${stripSignOff(draft.body)}\n\n${buildSignature(profile)}` }
}
