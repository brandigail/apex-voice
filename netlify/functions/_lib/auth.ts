import { Pool } from '@neondatabase/serverless'
import { betterAuth } from 'better-auth'

/** Netlify sets `URL` to the deployed site; BETTER_AUTH_URL overrides it (and is needed for local dev). */
const baseURL = process.env.BETTER_AUTH_URL ?? process.env.URL

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Profile fields live on the user row (see db/003_user_profile.sql) and are editable via updateUser.
  user: {
    additionalFields: {
      businessName: { type: 'string', required: false },
      role: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      signature: { type: 'string', required: false },
    },
  },
})
