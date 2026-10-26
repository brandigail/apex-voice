import { z } from 'zod'
import { READ_BACK_QUESTION, type AssistantAction, type AssistantResponse } from '../../src/types/assistant.ts'
import { runTool, TOOLS, type ToolContext } from './_lib/assistant-tools.ts'
import { assistantSystemPrompt } from './_lib/assistant-prompt.ts'
import { chat, type ChatMessage } from './_lib/groq-chat.ts'
import { errorResponse, json } from './_lib/http.ts'
import { claimQuota } from './_lib/rate-limit.ts'
import { requireUser } from './_lib/session.ts'
import { rememberTurn } from './_lib/conversations.ts'
import { safeTimeZone } from './_lib/time.ts'
import { SPOKEN_CODES } from '../../src/types/languages.ts'

/** Netlify's default function timeout is 10 s; leave a second for the response. */
const DEADLINE_MS = 9_000
/** Looking something up, then answering, then maybe one follow-up lookup. */
const MAX_ROUNDS = 4
const MIN_ROUND_MS = 1_200
const MAX_TURNS = 16
/**
 * The assistant runs on its own models so a conversation doesn't use up the token budget that drafts rely on.
 * Groq's free tier gives each model its own budget, so a second one is a fallback when the first is rate limited.
 */
const DEFAULT_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']

function assistantModels(): string[] {
  const configured = process.env.GROQ_ASSISTANT_MODEL
  return configured ? [configured, ...DEFAULT_MODELS.filter((m) => m !== configured)] : DEFAULT_MODELS
}

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(6_000),
        actions: z
          .array(z.object({ type: z.string().max(32), id: z.string().max(64), label: z.string().max(200) }))
          .max(5)
          .optional(),
      }),
    )
    .min(1)
    .max(MAX_TURNS),
  timeZone: z.string().max(64),
  conversationId: z.uuid(),
  spokenLanguage: z.string().refine((code) => SPOKEN_CODES.includes(code)).optional(),
})

/** Some models wrap their reasoning in <think> tags; it must never be spoken. */
function spoken(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}


/** After writing a draft the assistant always offers to read it back, in these exact words, whatever the model chose to say. */
function withReadBackQuestion(reply: string, actions: AssistantAction[]): string {
  if (!actions.some((a) => a.type === 'draft_created') || reply.includes(READ_BACK_QUESTION)) return reply
  const sentences = reply.match(/[^.!?]+[.!?]*/g) ?? [reply]
  const last = sentences[sentences.length - 1]?.trim() ?? ''
  const kept = /read/i.test(last) && last.endsWith('?') ? sentences.slice(0, -1) : sentences
  return `${kept.join('').trim()} ${READ_BACK_QUESTION}`.trim()
}

const CONFIRMATIONS: Record<AssistantAction['type'], string> = {
  draft_created: `I've written that up and saved it. ${READ_BACK_QUESTION}`,
  agenda_added: "That's on your agenda now.",
  marked_sent: "Done, I've marked that as sent.",
  send_scheduled: "I've set a reminder on your agenda.",
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.')

  const session = await requireUser(req)
  if (!session.ok) return session.response

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('GROQ_API_KEY is not configured')
    return errorResponse(500, 'Server is not configured.')
  }

  const request = requestSchema.safeParse(await req.json().catch(() => null))
  if (!request.success || request.data.messages[request.data.messages.length - 1].role !== 'user') {
    return errorResponse(400, 'Send the conversation so far, ending with what the user said.')
  }

  const quota = await claimQuota(session.user.id, 'assistant')
  if (!quota.ok) return quota.response

  const startedAt = Date.now()
  const timeZone = safeTimeZone(request.data.timeZone)
  const { profile } = session.user
  const ctx: ToolContext = {
    userId: session.user.id,
    profile,
    timeZone,
    apiKey,
    deadlineAt: startedAt + DEADLINE_MS,
    actions: [],
    spokenLanguage: request.data.spokenLanguage,
  }
  const { conversationId } = request.data
  const lastUserText = request.data.messages[request.data.messages.length - 1].content

  /** Saves the exchange to the user's history, then answers. */
  const respond = async (reply: string): Promise<Response> => {
    await rememberTurn(session.user.id, conversationId, lastUserText, reply, ctx.actions)
    return json<AssistantResponse>({ reply, actions: ctx.actions, speechLanguage: ctx.speechLanguage })
  }

  const models = assistantModels()
  const messages: ChatMessage[] = [
    { role: 'system', content: assistantSystemPrompt(profile, timeZone) },
    ...request.data.messages.map(({ role, content, actions }): ChatMessage => {
      if (role === 'user' || !actions?.length) return { role, content }
      const done = actions.map((a) => `${a.type} id=${a.id} (${a.label})`).join('; ')
      return { role, content: `${content}
[Apex did this: ${done}]` }
    }),
  ]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const remaining = ctx.deadlineAt - Date.now()
    if (remaining < MIN_ROUND_MS) break

    let result = await chat(apiKey, messages, remaining, { tools: TOOLS, temperature: 0.5, model: models[0] })
    for (const fallback of models.slice(1)) {
      if (result.ok || result.status !== 429) break
      result = await chat(apiKey, messages, ctx.deadlineAt - Date.now(), { tools: TOOLS, temperature: 0.5, model: fallback })
    }
    if (!result.ok) {
      if (result.status === 429) return errorResponse(429, 'The AI service is busy. Try again in a moment.')
      // The model sometimes makes a malformed tool call, which Groq rejects with 400. Asking again usually works.
      if (result.status === 400) continue
      break
    }

    if (result.toolCalls.length === 0) {
      const reply = spoken(result.content)
      if (reply) return respond(withReadBackQuestion(reply, ctx.actions))
      break
    }

    messages.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls })
    for (const call of result.toolCalls) {
      messages.push({ role: 'tool', tool_call_id: call.id, content: await runTool(call.function.name, call.function.arguments, ctx) })
    }
  }

  // Out of time or rounds. If something was already done, say so rather than losing it.
  if (ctx.actions.length > 0) {
    return respond([...new Set(ctx.actions.map((a) => a.type))].map((type) => CONFIRMATIONS[type]).join(' '))
  }
  return errorResponse(504, "Sorry, that took too long. Could you say it again?")
}
