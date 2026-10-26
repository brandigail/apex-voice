import { describeError, describeUpstream } from './safe-log.ts'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface ToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

interface GroqChatResponse {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
}

export type ChatResult =
  | { ok: true; content: string; toolCalls: ToolCall[] }
  | { ok: false; status: number }

export interface ChatOptions {
  /** Ask for a JSON object reply. Cannot be combined with tools. */
  json?: boolean
  tools?: ToolDefinition[]
  temperature?: number
  /** Overrides the default model (GROQ_MODEL). Each model has its own free-tier token budget. */
  model?: string
}

/** One call to Groq's chat endpoint. Never throws: failures come back as `{ ok: false, status }`. */
export async function chat(
  apiKey: string,
  messages: ChatMessage[],
  timeoutMs: number,
  options: ChatOptions = {},
): Promise<ChatResult> {
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model ?? (process.env.GROQ_MODEL || DEFAULT_MODEL),
        messages,
        temperature: options.temperature ?? 0.2,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
        ...(options.tools ? { tools: options.tools, tool_choice: 'auto' } : {}),
        // The gpt-oss models think before answering; a little thinking is plenty for a spoken reply.
        ...(options.model?.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      console.error('Groq chat error:', await describeUpstream(response))
      return { ok: false, status: response.status }
    }
    const message = ((await response.json()) as GroqChatResponse).choices?.[0]?.message
    return { ok: true, content: message?.content ?? '', toolCalls: message?.tool_calls ?? [] }
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    console.error('Groq chat request failed:', timedOut ? 'timeout' : describeError(err))
    return { ok: false, status: timedOut ? 504 : 502 }
  }
}
