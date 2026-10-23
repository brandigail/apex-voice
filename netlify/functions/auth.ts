import type { Config } from '@netlify/functions'
import { auth } from './_lib/auth.ts'

/** Better Auth serves every /api/auth/* route (sign-up, sign-in, sign-out, session). */
export default function handler(req: Request): Promise<Response> {
  return auth.handler(req)
}

export const config: Config = { path: '/api/auth/*' }
