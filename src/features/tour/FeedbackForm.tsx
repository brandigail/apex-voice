import { useState, type FormEvent } from 'react'
import { Check, Send } from 'lucide-react'
import { ApiRequestError, request } from '../../lib/api'

interface FeedbackFormProps {
  /** Which screen the person was on, saved with the note. */
  screen: string
  id: string
}

/** A box for a tester to say what they think; the note is saved with their account for the owner to read. */
export function FeedbackForm({ screen, id }: FeedbackFormProps) {
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (message.trim().length < 3) return
    setState('sending')
    setError(null)
    try {
      await request('/api/feedback', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, screen }) })
      setMessage('')
      setState('sent')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send your note. Please try again.')
      setState('idle')
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <label htmlFor={id} className="sr-only">
        Your feedback
      </label>
      <textarea
        id={id}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value)
          if (state === 'sent') setState('idle')
        }}
        rows={4}
        maxLength={2000}
        placeholder="For example: I liked talking to the assistant, but I wanted to…"
        className="field resize-y"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={state === 'sending' || message.trim().length < 3} className="btn btn-primary">
          <Send className="size-4" aria-hidden="true" />
          {state === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
        {state === 'sent' && (
          <p role="status" className="flex items-center gap-1 text-sm font-semibold text-emerald-500">
            <Check className="size-4" aria-hidden="true" />
            Thank you, we got it
          </p>
        )}
      </div>
    </form>
  )
}
