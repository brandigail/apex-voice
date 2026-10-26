import type { Config } from '@netlify/functions'
import { z } from 'zod'
import type { ConversationsResponse } from '../../src/types/conversation.ts'
import { deleteConversation, listConversations } from './_lib/conversations.ts'
import { errorResponse, json } from './_lib/http.ts'
import { requireUser } from './_lib/session.ts'

/** Routes are /api/conversations and /api/conversations/:id. */
function conversationIdFrom(req: Request): string | null {
  const [, , id] = new URL(req.url).pathname.split('/').filter(Boolean)
  return id?.replace(/\.html?$/, '') ?? null
}

export default async function handler(req: Request): Promise<Response> {
  const session = await requireUser(req)
  if (!session.ok) return session.response
  const id = conversationIdFrom(req)

  try {
    if (req.method === 'GET' && id === null) {
      return json<ConversationsResponse>({ conversations: await listConversations(session.user.id) })
    }
    if (req.method === 'DELETE' && id !== null) {
      if (!z.uuid().safeParse(id).success) return errorResponse(400, 'Invalid conversation id.')
      return (await deleteConversation(session.user.id, id)) ? json({ id }) : errorResponse(404, 'Conversation not found.')
    }
    return errorResponse(405, 'Method not allowed.')
  } catch (err) {
    console.error('Conversation request failed:', err)
    return errorResponse(500, 'Could not reach your conversation history. Please try again.')
  }
}

export const config: Config = { path: ['/api/conversations', '/api/conversations/*'] }
