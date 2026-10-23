import { useState } from 'react'
import { Check, Copy, Trash2 } from 'lucide-react'
import { draftToText } from '../../lib/share'
import type { Draft } from '../../types/draft'

interface DraftListItemProps {
  draft: Draft
  onDelete: (id: string) => Promise<boolean>
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const actionClass =
  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-500'

export function DraftListItem({ draft, onDelete }: DraftListItemProps) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const title = draft.subject || draft.recipient || 'Untitled draft'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftToText(draft))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked; nothing useful to show beyond the button not changing
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <details className="group">
        <summary className="flex flex-col gap-1 p-4">
          <span className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {draft.category}
            </span>
            <time dateTime={draft.createdAt} className="text-xs text-slate-500 dark:text-slate-400">
              {dateFormat.format(new Date(draft.createdAt))}
            </time>
          </span>
          <span className="font-semibold">{title}</span>
          {draft.subject && draft.recipient && (
            <span className="text-sm text-slate-500 dark:text-slate-400">To {draft.recipient}</span>
          )}
          <span className="line-clamp-2 text-sm text-slate-600 group-open:hidden dark:text-slate-400">{draft.body}</span>
        </summary>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`${actionClass} border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800`}
            >
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={() => void onDelete(draft.id).then((ok) => !ok && setConfirming(false))}
                  className={`${actionClass} border-red-600 bg-red-600 text-white hover:bg-red-700`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={`${actionClass} border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${actionClass} border-slate-300 text-red-700 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}
