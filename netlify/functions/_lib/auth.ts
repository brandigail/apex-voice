import { createHash, timingSafeEqual } from 'node:crypto'
import { errorResponse } from './http.ts'

export const PASSCODE_HEADER = 'x-passcode'

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/** Returns an error response if the request lacks the shared passcode, otherwise null. Fails closed if unset. */
export function checkPasscode(req: Request): Response | null {
  const expected = process.env.APP_PASSCODE
  if (!expected) {
    console.error('APP_PASSCODE is not configured')
    return errorResponse(500, 'Server is not configured.')
  }
  const provided = req.headers.get(PASSCODE_HEADER) ?? ''
  // Hashing first gives equal-length buffers, which timingSafeEqual requires.
  if (!timingSafeEqual(digest(provided), digest(expected))) {
    return errorResponse(401, 'Incorrect passcode.')
  }
  return null
}
