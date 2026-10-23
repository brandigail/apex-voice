import { createAuthClient } from 'better-auth/react'

/** Talks to the /api/auth/* Netlify Function on the same origin; the session lives in an HttpOnly cookie. */
export const authClient = createAuthClient()
