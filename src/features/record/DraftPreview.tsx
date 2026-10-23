import type { VoiceNoteResult } from './useVoiceNote'

interface DraftPreviewProps {
  result: VoiceNoteResult
}

/** Read-only view of a generated draft. Replaced by the editable card in step 9. */
export function DraftPreview({ result }: DraftPreviewProps) {
  const { draft, transcript } = result

  return (
    <article className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
        {draft.category}
      </span>
      {draft.recipient && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          To: <span className="text-slate-900 dark:text-slate-100">{draft.recipient}</span>
        </p>
      )}
      {draft.subject && <h2 className="mt-1 font-semibold">{draft.subject}</h2>}
      <p className="mt-3 whitespace-pre-wrap">{draft.body}</p>
      <details className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer">Transcript</summary>
        <p className="mt-2 whitespace-pre-wrap">{transcript}</p>
      </details>
    </article>
  )
}
