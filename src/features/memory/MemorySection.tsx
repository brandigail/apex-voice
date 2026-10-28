import { AlertCircle } from 'lucide-react'
import { ContactsList } from './ContactsList'
import { NotesList } from './NotesList'
import { useMemory } from './useMemory'

/** Everything Apex has been told to remember, in one place the person can read, correct and delete. */
export function MemorySection() {
  const { memories, contacts, error, addNote, editNote, removeNote, saveContact, removeContact } = useMemory()

  return (
    <section aria-labelledby="memory-heading" className="mt-10">
      <h2 id="memory-heading" className="text-2xl font-extrabold tracking-tight">
        What Apex knows about you
      </h2>
      <p className="muted mt-1 text-sm">
        Tell the assistant things once and it keeps them: how you like your messages written, your prices, the people you deal with. Drafts and answers use this
        automatically. It is stored encrypted, only you can see it, and you can change or delete any of it here.
      </p>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {memories === null && !error && (
        <p role="status" className="muted mt-4">
          Loading…
        </p>
      )}

      {memories && (
        <div className="surface mt-4 flex flex-col gap-6 p-5">
          <div>
            <h3 className="mb-2 text-sm font-bold">Notes</h3>
            <NotesList memories={memories} onAdd={addNote} onEdit={editNote} onRemove={removeNote} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">People</h3>
            <ContactsList contacts={contacts} onSave={saveContact} onRemove={removeContact} />
          </div>
        </div>
      )}
    </section>
  )
}
