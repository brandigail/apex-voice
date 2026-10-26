import { BellRing, X } from 'lucide-react'
import { useNow } from '../../lib/useNow'

interface SendAtFieldProps {
  id: string
  /** ISO time the user plans to send it, or null. */
  value: string | null
  /** True once the draft has been sent, so a past time is no longer "overdue". */
  sent: boolean
  disabled?: boolean
  onChange: (sendAt: string | null) => void
}

/** The browser's datetime-local input wants local wall-clock time without a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Lets someone plan when a draft should go out, so it can wait until the right time and shows up in their agenda. */
export function SendAtField({ id, value, sent, disabled, onChange }: SendAtFieldProps) {
  const now = useNow()
  const overdue = value !== null && !sent && new Date(value).getTime() < now

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <BellRing className="size-4 text-amber-400" aria-hidden="true" />
        Send at
        <span className="muted font-normal">(optional reminder)</span>
        {overdue && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-500">Overdue</span>}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="datetime-local"
          value={toLocalInput(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          className="field"
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label="Clear send time" className="btn btn-ghost px-3">
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
