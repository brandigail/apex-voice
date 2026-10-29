import { z } from 'zod'
import type { ToolContext } from './assistant-tools.ts'
import type { ToolDefinition } from './groq-chat.ts'
import { claimQuota } from './rate-limit.ts'
import { describeError, describeUpstream } from './safe-log.ts'
import { describeNow } from './time.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
/** Both models can search the web themselves; each has its own free token budget, so the second is the fallback. */
const SEARCH_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']
/** A search takes about 5 to 6 s; the whole assistant turn must still end inside Netlify's 10 s limit. */
const MAX_SEARCH_MS = 7_000
const MIN_SEARCH_MS = 3_000

export const LOOKUP_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'look_up',
      description:
        'Search the web for a real-world fact: shop or business opening hours, an address, a phone number, or a quick general question. Include the town. Never put private details (names of people, numbers, amounts) in the question.',
      parameters: {
        type: 'object',
        properties: { question: { type: 'string', description: 'For example "What time does Builders Warehouse in Somerset West close today?"' } },
        required: ['question'],
      },
    },
  },
]

const lookupArgs = z.object({ question: z.string().trim().min(3).max(300) })

interface SearchReply {
  choices?: { message?: { content?: string | null } }[]
}

function searchPrompt(timeZone: string): string {
  return `You answer one spoken question about the real world by searching the web. South Africa unless the question says otherwise. Right now it is ${describeNow(timeZone)}.
Reply in one or two plain spoken sentences: no markdown, links, citations or emoji.
For opening hours give today's hours for that exact branch. Say "it should" because listings can be out of date, and if sources disagree or you cannot find it, say so and suggest phoning the shop. Never guess.`
}

async function search(apiKey: string, model: string, question: string, timeZone: string, timeoutMs: number): Promise<{ status: number; text: string }> {
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning_effort: 'low',
        temperature: 0.2,
        tools: [{ type: 'browser_search' }],
        tool_choice: 'required',
        messages: [
          { role: 'system', content: searchPrompt(timeZone) },
          { role: 'user', content: question },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      console.error('Groq search error:', await describeUpstream(response))
      return { status: response.status, text: '' }
    }
    const content = ((await response.json()) as SearchReply).choices?.[0]?.message?.content ?? ''
    return { status: 200, text: content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/【[^】]*】/g, '').trim() }
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    console.error('Groq search request failed:', timedOut ? 'timeout' : describeError(err))
    return { status: timedOut ? 504 : 502, text: '' }
  }
}

/** Looks something up on the web. The answer is already worded for speaking, so it becomes the reply as it is. */
export async function runLookupTool(name: string, args: unknown, ctx: ToolContext): Promise<string | null> {
  if (name !== 'look_up') return null
  const parsed = lookupArgs.safeParse(args)
  if (!parsed.success) return JSON.stringify({ error: 'Ask what to look up, including the town.' })

  const budget = Math.min(MAX_SEARCH_MS, ctx.deadlineAt - Date.now() - 500)
  if (budget < MIN_SEARCH_MS) return JSON.stringify({ error: 'There is not enough time to search. Ask them to try again.' })

  const quota = await claimQuota(ctx.userId, 'lookup')
  if (!quota.ok) return JSON.stringify({ error: 'Too many searches for now. Say they can ask again later.' })

  let result = { status: 0, text: '' }
  for (const model of SEARCH_MODELS) {
    const remaining = Math.min(MAX_SEARCH_MS, ctx.deadlineAt - Date.now() - 500)
    if (remaining < MIN_SEARCH_MS) break
    result = await search(ctx.apiKey, model, parsed.data.question, ctx.timeZone, remaining)
    if (result.status !== 429) break
  }
  if (!result.text) return JSON.stringify({ error: 'The search did not work. Say you could not look it up right now.' })
  ctx.directReply = result.text
  return JSON.stringify({ answer: result.text })
}
