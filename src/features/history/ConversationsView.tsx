import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { AlertCircle, ChevronDown, MessagesSquare, Trash2 } from 'lucide-react'
import { ApiRequestError, request } from '../../lib/api'
import type { Conversation } from '../../types/conversation'

const conversationsSchema = z.object({
  conversations: z.array(
    z.object({
      id: z.string(),
      startedAt: z.string(),
      lastAt: z.string(),
      messages: z.array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
          actions: z.array(z.object({ type: z.string(), id: z.string(), label: z.string() })),
          createdAt: z.string(),
        }),
      ),
    }),
  ),
})

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function messageFrom(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'
}

/** Everything the user has said to the assistant, grouped by conversation, newest first. */
export function ConversationsView() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    request('/api/conversations', { method: 'GET' })
      .then((body) => {
        if (cancelled) return
        const parsed = conversationsSchema.safeParse(body)
        if (parsed.success) setConversations(parsed.data.conversations as Conversation[])
        else setError('The server sent an unexpected response.')
      })
      .catch((err: unknown) => !cancelled && setError(messageFrom(err)))
    return () => {
      cancelled = true
    }
  }, [])

  const remove = useCallback(
    async (id: string) => {
      const previous = conversations
      setConversations((current) => current?.filter((c) => c.id !== id) ?? null)
      setConfirming(null)
      try {
        await request(`/api/conversations/${id}`, { method: 'DELETE' })
      } catch (err) {
        setConversations(previous)
        setError(messageFrom(err))
      }
    },
    [conversations],
  )

  return (
    <div>
      <p className="muted mt-4 text-sm">Every conversation with your assistant, saved so you can look back at what was said and done.</p>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {conversations === null && !error && (
        <p role="status" className="muted mt-4">
          Loading your conversations…
        </p>
      )}

      {conversations?.length === 0 && (
        <p className="muted mt-4 flex items-center gap-2">
          <MessagesSquare className="size-5" aria-hidden="true" />
          No conversations yet. Open the Assistant tab and just talk.
        </p>
      )}

      {conversations && conversations.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {conversations.map((conversation) => {
            const first = conversation.messages.find((m) => m.role === 'user')?.content ?? 'Conversation'
            return (
              <li key={conversation.id} className="surface animate-rise overflow-hidden">
                <details className="group">
                  <summary className="flex items-start gap-3 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md">
                      <MessagesSquare className="size-5" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="muted text-xs">{dateFormat.format(new Date(conversation.lastAt))}</span>
                      <span className="line-clamp-2 font-semibold">{first}</span>
                      <span className="muted text-sm">{Math.ceil(conversation.messages.length / 2)} exchanges</span>
                    </span>
                    <ChevronDown className="muted mt-1 size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-(--line) p-4">
                    {conversation.messages.map((message, index) => (
                      <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <p
                          className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                            message.role === 'user' ? 'bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white' : 'bg-(--surface) border border-(--line)'
                          }`}
                        >
                          {message.content}
                        </p>
                        {message.actions.map((action) => (
                          <span key={action.id + action.type} className="muted mt-1 text-xs">
                            ✓ {action.label}
                          </span>
                        ))}
                      </div>
                    ))}
                    <div className="flex gap-2">
                      {confirming === conversation.id ? (
                        <>
                          <button type="button" onClick={() => void remove(conversation.id)} className="btn border border-red-600 bg-red-600 text-white hover:bg-red-700">
                            <Trash2 className="size-4" aria-hidden="true" />
                            Yes, delete
                          </button>
                          <button type="button" onClick={() => setConfirming(null)} className="btn btn-ghost">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirming(conversation.id)} className="btn btn-ghost text-red-600 dark:text-red-400">
                          <Trash2 className="size-4" aria-hidden="true" />
                          Delete conversation
                        </button>
                      )}
                    </div>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
