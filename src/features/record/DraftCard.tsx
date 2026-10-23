import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, MessageSquare } from 'lucide-react'
import { buildMailtoUrl, buildSmsUrl, draftToText } from '../../lib/share'
import { DRAFT_CATEGORIES, type DraftCategory, type GeneratedDraft } from '../../types/draft'
import type { VoiceNoteResult } from './useVoiceNote'

interface DraftCardProps {
  result: VoiceNoteResult
  onChange: (patch: Partial<GeneratedDraft>) => void
}

type CopyState = 'idle' | 'copied' | 'failed'

const CATEGORY_LABEL: Record<DraftCategory, string> = {
  EMAIL: 'Email',
  QUOTE: 'Quote',
  SMS: 'SMS',
  NOTE: 'Note',
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-950'
const actionClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

export function DraftCard({ result, onChange }: DraftCardProps) {
  const { draft, transcript } = result
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const resetTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    },
    [],
  )

  const hasSubject = draft.category === 'EMAIL' || draft.category === 'QUOTE'
  const canSend = draft.body.trim().length > 0
  const sendsAsSms = draft.category === 'SMS'
  const sendsAsMail = hasSubject

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftToText(draft))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2000)
  }

  return (
    <article
      aria-label="Draft"
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="draft-category" className="mb-1 block text-sm font-medium">
            Type
          </label>
          <select
            id="draft-category"
            value={draft.category}
            onChange={(e) => onChange({ category: e.target.value as DraftCategory })}
            className={fieldClass}
          >
            {DRAFT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </div>

        {draft.category !== 'NOTE' && (
          <div>
            <label htmlFor="draft-recipient" className="mb-1 block text-sm font-medium">
              To
            </label>
            <input
              id="draft-recipient"
              type="text"
              value={draft.recipient}
              onChange={(e) => onChange({ recipient: e.target.value })}
              placeholder={sendsAsSms ? 'Phone number or name' : 'Email address or name'}
              autoComplete="off"
              className={fieldClass}
            />
          </div>
        )}

        {hasSubject && (
          <div>
            <label htmlFor="draft-subject" className="mb-1 block text-sm font-medium">
              Subject
            </label>
            <input
              id="draft-subject"
              type="text"
              value={draft.subject}
              onChange={(e) => onChange({ subject: e.target.value })}
              className={fieldClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="draft-body" className="mb-1 block text-sm font-medium">
            Message
          </label>
          <textarea
            id="draft-body"
            value={draft.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={9}
            className={`${fieldClass} resize-y`}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!canSend}
            className={`${actionClass} border border-slate-300 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800`}
          >
            {copyState === 'copied' ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </button>

          {sendsAsMail && (
            <a
              href={canSend ? buildMailtoUrl(draft) : undefined}
              aria-disabled={!canSend}
              className={`${actionClass} bg-indigo-600 text-white hover:bg-indigo-700 aria-disabled:opacity-60`}
            >
              <Mail className="size-4" aria-hidden="true" />
              Open in mail
            </a>
          )}
          {sendsAsSms && (
            <a
              href={canSend ? buildSmsUrl(draft) : undefined}
              aria-disabled={!canSend}
              className={`${actionClass} bg-indigo-600 text-white hover:bg-indigo-700 aria-disabled:opacity-60`}
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              Open in messages
            </a>
          )}
        </div>
      </div>

      <details className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer">Transcript</summary>
        <p className="mt-2 whitespace-pre-wrap">{transcript}</p>
      </details>
    </article>
  )
}
