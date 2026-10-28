import { neon } from '@neondatabase/serverless'
import { MEMORY_LIMITS, type Contact, type ContactInput, type Memory, type MemoryKind } from '../../../src/types/memory.ts'
import { encryptText, openText } from './crypto.ts'

interface MemoryRow {
  id: string
  kind: MemoryKind
  content: string
  created_at: string | Date
  updated_at: string | Date
}

interface ContactRow {
  id: string
  name: string
  email: string
  phone: string
  relationship: string
  notes: string
  created_at: string | Date
  updated_at: string | Date
}

export type StoreResult<T> = { ok: true; value: T } | { ok: false; message: string }

const sql = () => neon(process.env.DATABASE_URL ?? '')
const iso = (value: string | Date) => new Date(value).toISOString()
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function toMemory(userId: string, row: MemoryRow): Memory {
  return {
    id: row.id,
    kind: row.kind,
    content: openText(userId, 'memories.content', row.content),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function toContact(userId: string, row: ContactRow): Contact {
  return {
    id: row.id,
    name: openText(userId, 'contacts.name', row.name),
    email: openText(userId, 'contacts.email', row.email),
    phone: openText(userId, 'contacts.phone', row.phone),
    relationship: openText(userId, 'contacts.relationship', row.relationship),
    notes: openText(userId, 'contacts.notes', row.notes),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

const sealContact = (userId: string, input: ContactInput): ContactInput => ({
  name: encryptText(userId, 'contacts.name', input.name),
  email: encryptText(userId, 'contacts.email', input.email),
  phone: encryptText(userId, 'contacts.phone', input.phone),
  relationship: encryptText(userId, 'contacts.relationship', input.relationship),
  notes: encryptText(userId, 'contacts.notes', input.notes),
})

/** Everything the user has asked Apex to remember, newest first. Text is encrypted at rest, so it is opened here. */
export async function listMemories(userId: string): Promise<Memory[]> {
  const rows = (await sql().query(
    `SELECT id, kind, content, created_at, updated_at FROM memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${MEMORY_LIMITS.memories}`,
    [userId],
  )) as MemoryRow[]
  return rows.map((row) => toMemory(userId, row))
}

export async function listContacts(userId: string): Promise<Contact[]> {
  const rows = (await sql().query(
    `SELECT id, name, email, phone, relationship, notes, created_at, updated_at FROM contacts WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${MEMORY_LIMITS.contacts}`,
    [userId],
  )) as ContactRow[]
  return rows.map((row) => toContact(userId, row))
}

/** Saves a memory. Telling Apex the same thing twice keeps one copy. */
export async function addMemory(userId: string, kind: MemoryKind, content: string): Promise<StoreResult<{ memory: Memory; duplicate: boolean }>> {
  const existing = await listMemories(userId)
  const duplicate = existing.find((m) => sameText(m.content, content))
  if (duplicate) return { ok: true, value: { memory: duplicate, duplicate: true } }
  if (existing.length >= MEMORY_LIMITS.memories) {
    return { ok: false, message: `The user already has ${MEMORY_LIMITS.memories} memories saved. Ask them to delete some.` }
  }
  const [row] = (await sql().query(
    `INSERT INTO memories (user_id, kind, content) VALUES ($1, $2, $3) RETURNING id, kind, content, created_at, updated_at`,
    [userId, kind, encryptText(userId, 'memories.content', content)],
  )) as MemoryRow[]
  return { ok: true, value: { memory: toMemory(userId, row), duplicate: false } }
}

export async function updateMemory(userId: string, id: string, kind: MemoryKind, content: string): Promise<Memory | null> {
  const [row] = (await sql().query(
    `UPDATE memories SET kind = $3, content = $4, updated_at = now() WHERE id = $1 AND user_id = $2
     RETURNING id, kind, content, created_at, updated_at`,
    [id, userId, kind, encryptText(userId, 'memories.content', content)],
  )) as MemoryRow[]
  return row ? toMemory(userId, row) : null
}

export async function deleteMemory(userId: string, id: string): Promise<Memory | null> {
  const [row] = (await sql().query(`DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id, kind, content, created_at, updated_at`, [id, userId])) as MemoryRow[]
  return row ? toMemory(userId, row) : null
}

/**
 * Saves a person. When someone with the same name is already known the details are merged into them, with only the
 * fields that were given replacing what was stored, so "Sipho's number is..." never wipes his email.
 */
export async function saveContact(userId: string, input: ContactInput): Promise<StoreResult<{ contact: Contact; created: boolean }>> {
  const existing = await listContacts(userId)
  const match = existing.find((c) => sameText(c.name, input.name))
  if (match) {
    const merged: ContactInput = {
      name: match.name,
      email: input.email || match.email,
      phone: input.phone || match.phone,
      relationship: input.relationship || match.relationship,
      notes: input.notes || match.notes,
    }
    const contact = await updateContact(userId, match.id, merged)
    return contact ? { ok: true, value: { contact, created: false } } : { ok: false, message: 'That contact could not be updated.' }
  }
  if (existing.length >= MEMORY_LIMITS.contacts) {
    return { ok: false, message: `The user already has ${MEMORY_LIMITS.contacts} contacts saved. Ask them to delete some.` }
  }
  const sealed = sealContact(userId, input)
  const [row] = (await sql().query(
    `INSERT INTO contacts (user_id, name, email, phone, relationship, notes) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, relationship, notes, created_at, updated_at`,
    [userId, sealed.name, sealed.email, sealed.phone, sealed.relationship, sealed.notes],
  )) as ContactRow[]
  return { ok: true, value: { contact: toContact(userId, row), created: true } }
}

export async function updateContact(userId: string, id: string, input: ContactInput): Promise<Contact | null> {
  const sealed = sealContact(userId, input)
  const [row] = (await sql().query(
    `UPDATE contacts SET name = $3, email = $4, phone = $5, relationship = $6, notes = $7, updated_at = now()
     WHERE id = $1 AND user_id = $2 RETURNING id, name, email, phone, relationship, notes, created_at, updated_at`,
    [id, userId, sealed.name, sealed.email, sealed.phone, sealed.relationship, sealed.notes],
  )) as ContactRow[]
  return row ? toContact(userId, row) : null
}

export async function deleteContact(userId: string, id: string): Promise<Contact | null> {
  const [row] = (await sql().query(
    `DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id, name, email, phone, relationship, notes, created_at, updated_at`,
    [id, userId],
  )) as ContactRow[]
  return row ? toContact(userId, row) : null
}
