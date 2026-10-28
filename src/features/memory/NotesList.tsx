import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { MEMORY_LIMITS, type Memory, type MemoryKind } from '../../types/memory'

interface NotesListProps {
  memories: Memory[]
  onAdd: (kind: MemoryKind, content: string) => Promise<boolean>
  onEdit: (id: string, kind: MemoryKind, content: string) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
}

const KIND_LABEL: Record<MemoryKind, string> = { preference: 'How I like things', fact: 'Good to know' }

function KindSelect({ id, value, onChange }: { id: string; value: MemoryKind; onChange: (kind: MemoryKind) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as MemoryKind)} className="field cursor-pointer sm:w-auto" aria-label="Type of note">
      <option value="fact">{KIND_LABEL.fact}</option>
      <option value="preference">{KIND_LABEL.preference}</option>
    </select>
  )
}

function NoteRow({ memory, onEdit, onRemove }: { memory: Memory; onEdit: NotesListProps['onEdit']; onRemove: NotesListProps['onRemove'] }) {
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState(memory.kind)
  const [text, setText] = useState(memory.content)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (await onEdit(memory.id, kind, text.trim())) setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
    setText(memory.content)
    setKind(memory.kind)
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <KindSelect id={`kind-${memory.id}`} value={kind} onChange={setKind} />
          <input value={text} maxLength={MEMORY_LIMITS.content} onChange={(e) => setText(e.target.value)} aria-label="Note" className="field flex-1" required />
          <div className="flex gap-2">
            <button type="submit" disabled={!text.trim()} className="btn btn-primary cursor-pointer" aria-label="Save note">
              <Check className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={cancel} className="btn btn-ghost cursor-pointer" aria-label="Cancel editing">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-start gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{memory.content}</p>
        <p className="muted mt-0.5 text-xs">{KIND_LABEL[memory.kind]}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost cursor-pointer" aria-label={`Edit: ${memory.content}`}>
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => void onRemove(memory.id)} className="btn btn-ghost cursor-pointer text-red-600 dark:text-red-400" aria-label={`Forget: ${memory.content}`}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}

/** Things Apex has been told to remember. They can be added here by typing or by telling the assistant out loud. */
export function NotesList({ memories, onAdd, onEdit, onRemove }: NotesListProps) {
  const [kind, setKind] = useState<MemoryKind>('fact')
  const [text, setText] = useState('')

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (await onAdd(kind, text.trim())) setText('')
  }

  return (
    <div>
      <form onSubmit={(e) => void add(e)} className="flex flex-col gap-2 sm:flex-row">
        <KindSelect id="new-note-kind" value={kind} onChange={setKind} />
        <input
          value={text}
          maxLength={MEMORY_LIMITS.content}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === 'preference' ? 'e.g. Keep my emails short and friendly' : 'e.g. I charge 15% VAT on every quote'}
          aria-label="New note"
          className="field flex-1"
        />
        <button type="submit" disabled={!text.trim()} className="btn btn-primary cursor-pointer">
          <Plus className="size-4" aria-hidden="true" />
          Add
        </button>
      </form>

      {memories.length === 0 ? (
        <p className="muted mt-4 text-sm">Nothing yet. Tell the assistant "remember that…" or add a note above.</p>
      ) : (
        <ul className="mt-3 divide-y divide-(--line) rounded-xl border border-(--line)">
          {memories.map((memory) => (
            <NoteRow key={memory.id} memory={memory} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  )
}
