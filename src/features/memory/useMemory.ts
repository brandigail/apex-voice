import { useCallback, useEffect, useState } from 'react'
import { ApiRequestError } from '../../lib/api'
import * as api from '../../lib/memory-api'
import type { Contact, ContactInput, Memory, MemoryKind } from '../../types/memory'

const messageFrom = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.')

/** Loads what Apex remembers and offers add, edit and delete. Every change is confirmed by the server before it shows. */
export function useMemory() {
  const [memories, setMemories] = useState<Memory[] | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .fetchMemory()
      .then((data) => {
        if (cancelled) return
        setMemories(data.memories)
        setContacts(data.contacts)
      })
      .catch((err: unknown) => !cancelled && setError(messageFrom(err)))
    return () => {
      cancelled = true
    }
  }, [])

  /** Runs a change; returns whether it worked, and leaves the message in `error` when it did not. */
  const attempt = useCallback(async (change: () => Promise<void>): Promise<boolean> => {
    setError(null)
    try {
      await change()
      return true
    } catch (err) {
      setError(messageFrom(err))
      return false
    }
  }, [])

  const addNote = (kind: MemoryKind, content: string) =>
    attempt(async () => {
      const memory = await api.addMemory(kind, content)
      setMemories((current) => [memory, ...(current ?? []).filter((m) => m.id !== memory.id)])
    })

  const editNote = (id: string, kind: MemoryKind, content: string) =>
    attempt(async () => {
      const memory = await api.updateMemory(id, kind, content)
      setMemories((current) => current?.map((m) => (m.id === id ? memory : m)) ?? null)
    })

  const removeNote = (id: string) =>
    attempt(async () => {
      await api.deleteMemory(id)
      setMemories((current) => current?.filter((m) => m.id !== id) ?? null)
    })

  const saveContact = (input: ContactInput, id?: string) =>
    attempt(async () => {
      const contact = await api.saveContact(input, id)
      setContacts((current) => (current.some((c) => c.id === contact.id) ? current.map((c) => (c.id === contact.id ? contact : c)) : [contact, ...current]))
    })

  const removeContact = (id: string) =>
    attempt(async () => {
      await api.deleteContact(id)
      setContacts((current) => current.filter((c) => c.id !== id))
    })

  return { memories, contacts, error, addNote, editNote, removeNote, saveContact, removeContact }
}
