import { useState, type FormEvent } from 'react'
import { Mail, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react'
import { MEMORY_LIMITS, type Contact, type ContactInput } from '../../types/memory'

interface ContactsListProps {
  contacts: Contact[]
  onSave: (input: ContactInput, id?: string) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
}

const EMPTY: ContactInput = { name: '', email: '', phone: '', relationship: '', notes: '' }

interface FieldProps {
  label: string
  value: string
  max: number
  type?: string
  required?: boolean
  onChange: (value: string) => void
}

function Field({ label, value, max, type = 'text', required, onChange }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      <input type={type} value={value} maxLength={max} required={required} onChange={(e) => onChange(e.target.value)} className="field text-sm font-normal" />
    </label>
  )
}

function ContactForm({ initial, onSave, onCancel }: { initial: ContactInput; onSave: (input: ContactInput) => Promise<boolean>; onCancel: () => void }) {
  const [draft, setDraft] = useState<ContactInput>({
    name: initial.name,
    email: initial.email,
    phone: initial.phone,
    relationship: initial.relationship,
    notes: initial.notes,
  })
  const set = (field: keyof ContactInput) => (value: string) => setDraft((current) => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await onSave(draft)) onCancel()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-3 p-3 sm:grid-cols-2">
      <Field label="Name" value={draft.name} max={MEMORY_LIMITS.name} required onChange={set('name')} />
      <Field label="Who they are to you" value={draft.relationship} max={MEMORY_LIMITS.relationship} onChange={set('relationship')} />
      <Field label="Email" type="email" value={draft.email} max={MEMORY_LIMITS.email} onChange={set('email')} />
      <Field label="Phone" type="tel" value={draft.phone} max={MEMORY_LIMITS.phone} onChange={set('phone')} />
      <div className="sm:col-span-2">
        <Field label="Notes" value={draft.notes} max={MEMORY_LIMITS.notes} onChange={set('notes')} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={!draft.name.trim()} className="btn btn-primary cursor-pointer">
          Save person
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  )
}

function ContactRow({ contact, onEdit, onRemove }: { contact: Contact; onEdit: () => void; onRemove: () => void }) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3">
      <UserRound className="muted mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-40 flex-1 text-sm">
        <p className="font-semibold">
          {contact.name} {contact.relationship && <span className="muted font-normal">· {contact.relationship}</span>}
        </p>
        {contact.email && (
          <p className="muted flex items-center gap-1.5 break-all text-xs">
            <Mail className="size-3 shrink-0" aria-hidden="true" />
            {contact.email}
          </p>
        )}
        {contact.phone && (
          <p className="muted flex items-center gap-1.5 text-xs">
            <Phone className="size-3 shrink-0" aria-hidden="true" />
            {contact.phone}
          </p>
        )}
        {contact.notes && <p className="muted mt-0.5 text-xs">{contact.notes}</p>}
      </div>
      <button type="button" onClick={onEdit} className="btn btn-ghost ml-auto cursor-pointer" aria-label={`Edit ${contact.name}`}>
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onRemove} className="btn btn-ghost cursor-pointer text-red-600 dark:text-red-400" aria-label={`Forget ${contact.name}`}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}

/** The people Apex knows, so "email Sipho" comes out addressed to the right person. */
export function ContactsList({ contacts, onSave, onRemove }: ContactsListProps) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const stopEditing = () => setEditing(null)

  return (
    <div>
      {editing === 'new' ? (
        <div className="rounded-xl border border-(--line)">
          <ContactForm initial={EMPTY} onSave={(input) => onSave(input)} onCancel={stopEditing} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className="btn btn-ghost cursor-pointer">
          <Plus className="size-4" aria-hidden="true" />
          Add a person
        </button>
      )}

      {contacts.length === 0 ? (
        <p className="muted mt-4 text-sm">No one yet. Tell the assistant "save Sipho, my accountant, his email is…" or add a person above.</p>
      ) : (
        <ul className="mt-3 divide-y divide-(--line) rounded-xl border border-(--line)">
          {contacts.map((contact) =>
            editing === contact.id ? (
              <li key={contact.id}>
                <ContactForm initial={contact} onSave={(input) => onSave(input, contact.id)} onCancel={stopEditing} />
              </li>
            ) : (
              <ContactRow key={contact.id} contact={contact} onEdit={() => setEditing(contact.id)} onRemove={() => void onRemove(contact.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  )
}
