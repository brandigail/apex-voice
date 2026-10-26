import { Search } from 'lucide-react'
import { CHANNELS } from '../../lib/channels'
import type { DraftCategory } from '../../types/draft'

export type CategoryFilter = DraftCategory | 'ALL'

interface HistoryFiltersProps {
  query: string
  onQuery: (query: string) => void
  category: CategoryFilter
  onCategory: (category: CategoryFilter) => void
}

const OPTIONS: readonly { id: CategoryFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  ...CHANNELS.map(({ id, label }) => ({ id, label })),
]

export function HistoryFilters({ query, onQuery, category, onCategory }: HistoryFiltersProps) {
  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="relative">
        <Search className="muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search recipient, subject or message"
          aria-label="Search drafts"
          className="field pl-10"
        />
      </div>
      <div
        role="group"
        aria-label="Filter by type"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={category === option.id}
            onClick={() => onCategory(option.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${
              category === option.id
                ? 'border-transparent bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/30'
                : 'border-(--line) bg-(--surface) hover:border-violet-400/70'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
