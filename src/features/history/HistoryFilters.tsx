import { Search } from 'lucide-react'
import { DRAFT_CATEGORIES, type DraftCategory } from '../../types/draft'

export type CategoryFilter = DraftCategory | 'ALL'

interface HistoryFiltersProps {
  query: string
  onQuery: (query: string) => void
  category: CategoryFilter
  onCategory: (category: CategoryFilter) => void
}

const LABEL: Record<CategoryFilter, string> = {
  ALL: 'All',
  EMAIL: 'Email',
  QUOTE: 'Quote',
  SMS: 'SMS',
  NOTE: 'Note',
}

const OPTIONS: readonly CategoryFilter[] = ['ALL', ...DRAFT_CATEGORIES]

export function HistoryFilters({ query, onQuery, category, onCategory }: HistoryFiltersProps) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search recipient, subject or message"
          aria-label="Search drafts"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={category === option}
            onClick={() => onCategory(option)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${
              category === option
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {LABEL[option]}
          </button>
        ))}
      </div>
    </div>
  )
}
