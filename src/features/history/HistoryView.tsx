import { useMemo, useState } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { ConversationsView } from './ConversationsView'
import { DraftListItem } from './DraftListItem'
import { HistoryFilters, type CategoryFilter, type StatusFilter } from './HistoryFilters'
import { useDrafts } from './useDrafts'

type Section = 'drafts' | 'conversations'

const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: 'drafts', label: 'Drafts' },
  { id: 'conversations', label: 'Conversations' },
]

const NEVER = Number.MAX_SAFE_INTEGER

export function HistoryView() {
  const [section, setSection] = useState<Section>('drafts')

  return (
    <section aria-labelledby="history-heading">
      <h1 id="history-heading" className="text-3xl font-extrabold tracking-tight">
        Your <span className="text-gradient">history</span>
      </h1>
      <div role="tablist" aria-label="History sections" className="surface mt-4 flex gap-1 p-1">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
              section === id ? 'bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md' : 'muted hover:bg-violet-500/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'drafts' ? <DraftsSection /> : <ConversationsView />}
    </section>
  )
}

function DraftsSection() {
  const { drafts, status: loadStatus, error, reload, remove, updateStatus } = useDrafts()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')

  const unsentCount = useMemo(() => drafts.filter((draft) => draft.sentAt === null).length, [drafts])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = drafts.filter(
      (draft) =>
        (category === 'ALL' || draft.category === category) &&
        (status === 'ALL' || (status === 'SENT') === (draft.sentAt !== null)) &&
        (needle === '' || [draft.recipient, draft.subject, draft.body, draft.transcript].some((field) => field.toLowerCase().includes(needle))),
    )
    // "To send" shows what is due soonest first; drafts with no planned time follow, newest first.
    return status === 'UNSENT'
      ? [...matching].sort((a, b) => (a.sendAt ? Date.parse(a.sendAt) : NEVER) - (b.sendAt ? Date.parse(b.sendAt) : NEVER))
      : matching
  }, [drafts, query, category, status])

  return (
    <div>
      {loadStatus === 'loading' && (
        <p role="status" className="muted mt-4">
          Loading your drafts…
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p>{error}</p>
            {loadStatus === 'error' && (
              <button type="button" onClick={reload} className="btn btn-ghost mt-3">
                <RotateCcw className="size-4" aria-hidden="true" />
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {loadStatus === 'ready' && drafts.length === 0 && (
        <p className="muted mt-4">No drafts yet. Record a voice note and it will be saved here automatically.</p>
      )}

      {drafts.length > 0 && (
        <HistoryFilters
          query={query}
          onQuery={setQuery}
          category={category}
          onCategory={setCategory}
          status={status}
          onStatus={setStatus}
          unsentCount={unsentCount}
        />
      )}

      {drafts.length > 0 && visible.length === 0 && (
        <p className="muted mt-4">{status === 'UNSENT' && query === '' ? 'Nothing waiting to be sent.' : 'No drafts match your search.'}</p>
      )}

      {visible.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {visible.map((draft) => (
            <DraftListItem key={draft.id} draft={draft} onDelete={remove} onUpdateStatus={updateStatus} />
          ))}
        </ul>
      )}
    </div>
  )
}
