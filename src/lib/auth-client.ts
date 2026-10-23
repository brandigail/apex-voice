import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

/** Talks to the /api/auth/* Netlify Function on the same origin; the session lives in an HttpOnly cookie. */
export const authClient = createAuthClient({
  // Mirrors `user.additionalFields` in netlify/functions/_lib/auth.ts so session.user and updateUser are typed.
  plugins: [
    inferAdditionalFields({
      user: {
        businessName: { type: 'string', required: false },
        role: { type: 'string', required: false },
        phone: { type: 'string', required: false },
        signature: { type: 'string', required: false },
      },
    }),
  ],
})
