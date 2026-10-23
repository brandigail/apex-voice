/** What a user tells Apex about themselves so drafts are written and signed in their name. */
export interface Profile {
  name: string
  businessName: string
  role: string
  phone: string
  /** Optional custom sign-off. When empty, one is built from the other fields. */
  signature: string
}

export const PROFILE_LIMITS = {
  name: 100,
  businessName: 120,
  role: 80,
  phone: 40,
  signature: 500,
} as const satisfies Record<keyof Profile, number>

/** The user fields Better Auth stores; extra profile columns are null until the user fills them in. */
export interface ProfileSource {
  name: string
  businessName?: string | null
  role?: string | null
  phone?: string | null
  signature?: string | null
}
