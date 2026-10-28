import { z } from 'zod'
import { MEMORY_KINDS, MEMORY_LIMITS } from '../../../src/types/memory.ts'
import { contactInputSchema, memoryInputSchema } from '../../../src/types/memory-schema.ts'
import type { ToolContext } from './assistant-tools.ts'
import type { ToolDefinition } from './groq-chat.ts'
import { addMemory, deleteContact, deleteMemory, listContacts, listMemories, saveContact } from './memory-store.ts'

const RECALL_LIMIT = 12

export const MEMORY_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Save a lasting preference (how they like things written or done) or fact (about them, their business, prices, routine). Not one-off events, and never passwords, PINs, card or ID numbers.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'One short third-person sentence, for example "Charges 15% VAT on quotes".' },
          kind: { type: 'string', enum: [...MEMORY_KINDS], description: 'preference is always applied; fact is used when relevant.' },
        },
        required: ['text', 'kind'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_contact',
      description: 'Save or update a person or company they deal with. The same name adds to the existing contact. Only details they gave.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          relationship: { type: 'string', description: 'For example "accountant" or "customer".' },
          notes: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall',
      description: 'Search everything you remember (notes and contacts) when asked what you know, or when an answer may depend on something told earlier that is not listed already.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'A name or topic. Omit to list recent items.' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget',
      description: 'Delete a saved note or contact by id (from recall) when asked to forget it.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
]

const rememberArgs = z.object({ text: memoryInputSchema.shape.content, kind: memoryInputSchema.shape.kind })
const recallArgs = z.object({ query: z.string().trim().max(100).optional() })
const forgetArgs = z.object({ id: z.uuid() })

const fail = (message: string) => JSON.stringify({ error: message })
const short = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}...` : text)

async function remember(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = rememberArgs.safeParse(args)
  if (!parsed.success) return fail(`Give a short sentence (at most ${MEMORY_LIMITS.content} characters) and whether it is a preference or a fact.`)
  const result = await addMemory(ctx.userId, parsed.data.kind, parsed.data.text)
  if (!result.ok) return fail(result.message)
  const { memory, duplicate } = result.value
  if (duplicate) return JSON.stringify({ alreadyKnown: true })
  ctx.actions.push({ type: 'memory_saved', id: memory.id, label: short(memory.content) })
  return JSON.stringify({ saved: true })
}

async function saveContactTool(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = contactInputSchema.safeParse(args)
  if (!parsed.success) return fail('Give at least the name.')
  const result = await saveContact(ctx.userId, parsed.data)
  if (!result.ok) return fail(result.message)
  const { contact, created } = result.value
  ctx.actions.push({ type: 'contact_saved', id: contact.id, label: contact.name })
  return JSON.stringify({ saved: true, created, name: contact.name })
}

async function recall(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = recallArgs.safeParse(args)
  if (!parsed.success) return fail('That search was not valid.')
  const needle = parsed.data.query?.toLowerCase()
  const [memories, contacts] = await Promise.all([listMemories(ctx.userId), listContacts(ctx.userId)])
  const matches = (...texts: string[]) => !needle || texts.some((t) => t.toLowerCase().includes(needle))
  return JSON.stringify({
    memories: memories
      .filter((m) => matches(m.content))
      .slice(0, RECALL_LIMIT)
      .map((m) => ({ id: m.id, kind: m.kind, text: m.content })),
    contacts: contacts
      .filter((c) => matches(c.name, c.relationship, c.email, c.notes))
      .slice(0, RECALL_LIMIT)
      .map(({ id, name, email, phone, relationship, notes }) => ({ id, name, email, phone, relationship, notes })),
  })
}

async function forget(args: unknown, ctx: ToolContext): Promise<string> {
  const parsed = forgetArgs.safeParse(args)
  if (!parsed.success) return fail('Give the id from recall.')
  const memory = await deleteMemory(ctx.userId, parsed.data.id)
  if (memory) {
    ctx.actions.push({ type: 'memory_forgotten', id: memory.id, label: short(memory.content) })
    return JSON.stringify({ forgotten: true })
  }
  const contact = await deleteContact(ctx.userId, parsed.data.id)
  if (contact) {
    ctx.actions.push({ type: 'memory_forgotten', id: contact.id, label: contact.name })
    return JSON.stringify({ forgotten: true })
  }
  return fail('Nothing with that id was found.')
}

/** Runs a memory tool, or returns null when the name belongs to another group of tools. */
export async function runMemoryTool(name: string, args: unknown, ctx: ToolContext): Promise<string | null> {
  switch (name) {
    case 'remember':
      return remember(args, ctx)
    case 'save_contact':
      return saveContactTool(args, ctx)
    case 'recall':
      return recall(args, ctx)
    case 'forget':
      return forget(args, ctx)
    default:
      return null
  }
}
