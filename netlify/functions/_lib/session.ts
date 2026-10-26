import { profileFromUser } from '../../../src/lib/profile.ts'
import type { Profile } from '../../../src/types/profile.ts'
import { auth } from './auth.ts'
import { openCalendarLink } from './calendar-secret.ts'
import { errorResponse } from './http.ts'
import { describeError } from './safe-log.ts'

export interface SessionUser {
  id: string
  email: string
  profile: Profile
}

type UserResult = { ok: true; user: SessionUser } | { ok: false; response: Response }

/** Resolves the signed-in user from the session cookie, or a 401 response to return as-is. */
export async function requireUser(req: Request): Promise<UserResult> {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (session) {
      const { id, email } = session.user
      const profile = profileFromUser(session.user)
      // The saved calendar link is encrypted; servers use the opened copy, and the browser only ever sees the sealed one.
      return { ok: true, user: { id, email, profile: { ...profile, calendarUrl: openCalendarLink(profile.calendarUrl) } } }
    }
  } catch (err) {
    console.error('Session lookup failed:', describeError(err))
    return { ok: false, response: errorResponse(500, 'Could not verify your session. Please try again.') }
  }
  return { ok: false, response: errorResponse(401, 'Please sign in.') }
}
