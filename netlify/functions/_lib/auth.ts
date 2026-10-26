import { Pool } from '@neondatabase/serverless'
import { betterAuth } from 'better-auth'
import { sealCalendarLink } from './calendar-secret.ts'

/** Netlify sets `URL` to the deployed site; BETTER_AUTH_URL overrides it (and is needed for local dev). */
const baseURL = process.env.BETTER_AUTH_URL ?? process.env.URL

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Sign-up is closed unless ALLOW_SIGNUP=true, so strangers cannot make accounts and use the AI quota.
    disableSignUp: process.env.ALLOW_SIGNUP !== 'true',
  },
  // Serverless instances don't share memory, so rate-limit counters live in the database (db/004_usage_limits.sql).
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 8 },
      '/sign-up/email': { window: 3600, max: 10 },
    },
  },
  advanced: {
    // Netlify puts the real client address in x-nf-client-connection-ip.
    ipAddress: { ipAddressHeaders: ['x-nf-client-connection-ip', 'x-forwarded-for'] },
  },
  // Profile fields live on the user row (see db/003_user_profile.sql) and are editable via updateUser.
  // The calendar link works like a password to the whole calendar, so it is encrypted before it is saved (see crypto.ts).
  databaseHooks: {
    user: {
      create: { before: async (user) => ({ data: sealCalendarLink(user) }) },
      update: { before: async (user) => ({ data: sealCalendarLink(user) }) },
    },
  },
  user: {
    deleteUser: { enabled: true },
    additionalFields: {
      businessName: { type: 'string', required: false },
      role: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      signature: { type: 'string', required: false },
      calendarUrl: { type: 'string', required: false },
    },
  },
})
