import { neon } from '@neondatabase/serverless'
import type { AssistantAction } from '../../../src/types/assistant.ts'
import type { Conversation, ConversationMessage } from '../../../src/types/conversation.ts'

/** Most messages kept per user; the oldest are dropped so the history can't grow without limit. */
const MAX_MESSAGES_PER_USER = 1000
const PRUNE_ONE_IN = 20
const LIST_CONVERSATIONS = 40
const LIST_MESSAGES = 2000

/** Saves one exchange (what the user said and what Apex answered) to the user's assistant history. Never throws. */
export async function rememberTurn(
  userId: string,
  conversationId: string,
  userText: string,
  reply: string,
  actions: AssistantAction[],
): Promise<void> {
  try {
    const sql = neon(process.env.DATABASE_URL ?? '')
    await sql.query(
      `INSERT INTO assistant_messages (user_id, conversation_id, role, content, created_at)
       VALUES ($1, $2, 'user', $3, now() - interval '1 second'),
              ($1, $2, 'assistant', $4, now())`,
      [userId, conversationId, userText, reply],
    )
    if (actions.length > 0) {
      await sql.query(
        `UPDATE assistant_messages SET actions = $3::jsonb
         WHERE id = (SELECT max(id) FROM assistant_messages WHERE user_id = $1 AND conversation_id = $2 AND role = 'assistant')`,
        [userId, conversationId, JSON.stringify(actions)],
      )
    }
    if (Math.random() < 1 / PRUNE_ONE_IN) {
      await sql.query(
        `DELETE FROM assistant_messages WHERE user_id = $1 AND id NOT IN
           (SELECT id FROM assistant_messages WHERE user_id = $1 ORDER BY id DESC LIMIT ${MAX_MESSAGES_PER_USER})`,
        [userId],
      )
    }
  } catch (err) {
    console.error('Could not save the conversation turn:', err)
  }
}

interface MessageRow {
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  actions: AssistantAction[]
  created_at: string | Date
}

/** The user's recent conversations, newest first, each with its messages in order. */
export async function listConversations(userId: string): Promise<Conversation[]> {
  const sql = neon(process.env.DATABASE_URL ?? '')
  const rows = (await sql.query(
    `SELECT conversation_id, role, content, actions, created_at FROM assistant_messages
     WHERE user_id = $1 ORDER BY id DESC LIMIT ${LIST_MESSAGES}`,
    [userId],
  )) as MessageRow[]

  const byConversation = new Map<string, ConversationMessage[]>()
  for (const row of rows.reverse()) {
    const message: ConversationMessage = {
      role: row.role,
      content: row.content,
      actions: row.actions,
      createdAt: new Date(row.created_at).toISOString(),
    }
    byConversation.set(row.conversation_id, [...(byConversation.get(row.conversation_id) ?? []), message])
  }

  return [...byConversation.entries()]
    .map(([id, messages]) => ({ id, startedAt: messages[0].createdAt, lastAt: messages[messages.length - 1].createdAt, messages }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, LIST_CONVERSATIONS)
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL ?? '')
  const rows = await sql.query('DELETE FROM assistant_messages WHERE user_id = $1 AND conversation_id = $2 RETURNING id', [
    userId,
    conversationId,
  ])
  return rows.length > 0
}
