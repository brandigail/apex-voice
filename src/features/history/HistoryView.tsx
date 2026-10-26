import { useMemo, useState } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import type { DraftCategory } from '../../types/draft'
import { DraftListItem } from './DraftListItem'
import { HistoryFilters } from './HistoryFilters'
import { useDrafts } from './useDrafts'

export function HistoryView() {
  const { drafts, status, error, reload, remove } = useDrafts()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<DraftCategory | 'ALL'>('ALL')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return drafts.filter(
      (draft) =>
        (category === 'ALL' || draft.category === category) &&
        (needle === '' ||
          [draft.recipient, draft.subject, draft.body, draft.transcript].some((field) =>
            field.toLowerCase().includes(needle),
          )),
    )
  }, [drafts, query, category])

  return (
    <section aria-labelledby="history-heading">
      <h1 id="history-heading" className="text-2xl font-bold">
        Draft history
      </h1>

      {status === 'loading' && (
        <p role="status" className="mt-4 text-slate-500 dark:text-slate-400">
          Loading your drafts…
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p>{error}</p>
            {status === 'error' && (
              <button
                type="button"
                onClick={reload}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-500 dark:border-red-800 dark:hover:bg-red-900"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'ready' && drafts.length === 0 && (
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          No drafts yet. Record a voice note and it will be saved here automatically.
        </p>
      )}

      {drafts.length > 0 && (
        <HistoryFilters query={query} onQuery={setQuery} category={category} onCategory={setCategory} />
      )}

      {drafts.length > 0 && visible.length === 0 && (
        <p className="mt-4 text-slate-600 dark:text-slate-400">No drafts match your search.</p>
      )}

      {visible.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {visible.map((draft) => (
            <DraftListItem key={draft.id} draft={draft} onDelete={remove} />
          ))}
        </ul>
      )}
    </section>
  )
}
