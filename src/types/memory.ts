/** A preference is how the user likes things written or done and always applies; a fact is something to know when it comes up. */
export const MEMORY_KINDS = ['preference', 'fact'] as const
export type MemoryKind = (typeof MEMORY_KINDS)[number]

/** One thing Apex has been told to remember about the user, their business or their way of working. */
export interface Memory {
  id: string
  kind: MemoryKind
  content: string
  createdAt: string
  updatedAt: string
}

/** A person or company the user deals with, so "email Sipho" can be filled in correctly. */
export interface Contact {
  id: string
  name: string
  email: string
  phone: string
  relationship: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ContactInput = Pick<Contact, 'name' | 'email' | 'phone' | 'relationship' | 'notes'>

export interface MemoryResponse {
  memories: Memory[]
  contacts: Contact[]
}

export const MEMORY_LIMITS = {
  content: 300,
  name: 100,
  email: 200,
  phone: 40,
  relationship: 80,
  notes: 300,
  /** Most of each a user may keep, so what is read on every turn stays small. */
  memories: 150,
  contacts: 200,
} as const
