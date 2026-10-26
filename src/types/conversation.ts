import type { AssistantAction } from './assistant.ts'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  actions: AssistantAction[]
  createdAt: string
}

/** One sitting with the assistant, from the first thing said to the last reply. */
export interface Conversation {
  id: string
  startedAt: string
  lastAt: string
  messages: ConversationMessage[]
}

export interface ConversationsResponse {
  conversations: Conversation[]
}
