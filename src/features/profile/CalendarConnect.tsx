import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { z } from 'zod'
import { CalendarCheck, CheckCircle2, ClipboardPaste, ExternalLink, Link2Off, X } from 'lucide-react'
import { ApiRequestError, request } from '../../lib/api'
import type { CalendarCheckResponse } from '../../types/agenda'

type ProviderId = 'google' | 'outlook' | 'apple' | 'other'

interface Provider {
  id: ProviderId
  name: string
  /** Opens the page where this provider shows the private address. */
  openLabel?: string
  openUrl?: string
  steps: readonly string[]
  accent: string
}

const PROVIDERS: readonly Provider[] = [
  {
    id: 'google',
    name: 'Google Calendar',
    openLabel: 'Open Google Calendar settings',
    openUrl: 'https://calendar.google.com/calendar/u/0/r/settings',
    steps: [
      'Under "Settings for my calendars", tap your calendar.',
      'Scroll down to "Integrate calendar".',
      'Copy the "Secret address in iCal format".',
    ],
    accent: '#4285f4',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    openLabel: 'Open Outlook calendar sharing',
    openUrl: 'https://outlook.live.com/calendar/0/options/calendar/SharedCalendars',
    steps: [
      'Under "Publish a calendar", pick your calendar.',
      'Choose "Can view all details" and tap Publish.',
      'Copy the ICS link that appears. (Work accounts may need your IT admin to allow this.)',
    ],
    accent: '#0a64ad',
  },
  {
    id: 'apple',
    name: 'Apple (iCloud)',
    openLabel: 'Open iCloud Calendar',
    openUrl: 'https://www.icloud.com/calendar/',
    steps: [
      'On your iPhone: Calendar, then Calendars, then the (i) next to your calendar.',
      'Turn on "Public Calendar" and tap "Share Link".',
      'Choose Copy.',
    ],
    accent: '#8e8e93',
  },
  {
    id: 'other',
    name: 'Something else',
    steps: ['Most calendar apps can publish a private address ending in .ics.', 'Copy that address.'],
    accent: '#8b5cf6',
  },
]

const checkSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  count: z.number(),
  next: z.array(z.object({ title: z.string(), startsAt: z.string(), allDay: z.boolean() })),
})

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

interface CalendarConnectProps {
  /** The saved calendar address, or "" when none is linked. */
  url: string
  /** Saves the new address (or "" to disconnect). */
  onChange: (url: string) => Promise<boolean>
}

/** Guides someone through linking their calendar: pick the app, copy the address with a few taps, test it, done. */
export function CalendarConnect({ url, onChange }: CalendarConnectProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CalendarCheckResponse | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const open = () => {
    setProvider(null)
    setDraft('')
    setResult(null)
    setProblem(null)
    dialogRef.current?.showModal()
  }
  const close = () => dialogRef.current?.close()

  useEffect(() => {
    const dialog = dialogRef.current
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) dialog?.close()
    }
    dialog?.addEventListener('click', closeOnBackdrop)
    return () => dialog?.removeEventListener('click', closeOnBackdrop)
  }, [])

  const check = async (address: string) => {
    setChecking(true)
    setProblem(null)
    setResult(null)
    try {
      const body = checkSchema.safeParse(await request('/api/calendar-check', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: address }) }))
      if (!body.success) throw new ApiRequestError(502, 'The server sent an unexpected response.')
      if (body.data.ok) setResult(body.data)
      else setProblem(body.data.error ?? 'That link did not work.')
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  /** One tap: read the copied address from the clipboard and test it straight away. */
  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      setDraft(text)
      if (text) await check(text)
    } catch {
      setProblem('Your browser would not let me read the clipboard. Paste the link into the box instead.')
    }
  }

  const use = async () => {
    setSaving(true)
    const saved = await onChange(draft.trim())
    setSaving(false)
    if (saved) close()
    else setProblem('Could not save the link. Please try again.')
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">
        Calendar <span className="muted font-normal">(optional)</span>
      </p>
      <div className="surface flex flex-col gap-3 p-4">
        {url ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
            <CheckCircle2 className="size-5" aria-hidden="true" />
            Calendar connected
          </p>
        ) : (
          <p className="muted text-sm">Link your calendar so the assistant knows your meetings.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={open} className="btn btn-primary">
            <CalendarCheck className="size-4" aria-hidden="true" />
            {url ? 'Change calendar' : 'Connect calendar'}
          </button>
          {url && (
            <button type="button" onClick={() => void onChange('')} className="btn btn-ghost">
              <Link2Off className="size-4" aria-hidden="true" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {createPortal(
      <dialog
        ref={dialogRef}
        aria-labelledby="calendar-dialog-title"
        className="m-auto w-[min(92vw,30rem)] rounded-3xl border border-(--line) bg-(--surface-strong) p-0 text-(--ink) shadow-2xl backdrop:bg-black/60"
      >
        <div className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="calendar-dialog-title" className="text-xl font-bold">
              {provider ? provider.name : 'Which calendar do you use?'}
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-violet-500/15">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {!provider ? (
            <div className="grid grid-cols-2 gap-3">
              {PROVIDERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setProvider(option)}
                  className="surface flex flex-col items-start gap-2 p-4 text-left font-semibold hover:border-violet-400/70"
                >
                  <span className="size-3 rounded-full" style={{ background: option.accent }} aria-hidden="true" />
                  {option.name}
                </button>
              ))}
            </div>
          ) : (
            <>
              <ol className="muted list-decimal space-y-1.5 pl-5 text-sm">
                {provider.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              {provider.openUrl && (
                <a href={provider.openUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {provider.openLabel}
                </a>
              )}

              <button type="button" onClick={() => void paste()} disabled={checking} className="btn btn-primary">
                <ClipboardPaste className="size-4" aria-hidden="true" />
                {checking ? 'Checking…' : 'Paste the link and test it'}
              </button>

              <div>
                <label htmlFor="calendar-link" className="mb-1.5 block text-sm font-semibold">
                  Or paste it here
                </label>
                <div className="flex gap-2">
                  <input
                    id="calendar-link"
                    type="url"
                    inputMode="url"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      setResult(null)
                    }}
                    placeholder="https://… or webcal://…"
                    autoComplete="off"
                    className="field"
                  />
                  <button type="button" onClick={() => void check(draft.trim())} disabled={checking || draft.trim().length < 8} className="btn btn-ghost">
                    Test
                  </button>
                </div>
              </div>

              {problem && (
                <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                  {problem}
                </p>
              )}

              {result && (
                <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    It works. Found {result.count} {result.count === 1 ? 'event' : 'events'} in the next 30 days.
                  </p>
                  {result.next.length > 0 && (
                    <ul className="muted mt-1 space-y-0.5">
                      {result.next.map((event) => (
                        <li key={event.title + event.startsAt}>
                          {event.title} · {event.allDay ? 'all day' : dateFormat.format(new Date(event.startsAt))}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" onClick={() => void use()} disabled={saving} className="btn btn-primary mt-3 w-full">
                    {saving ? 'Saving…' : 'Use this calendar'}
                  </button>
                </div>
              )}

              <button type="button" onClick={() => setProvider(null)} className="muted self-start text-sm underline">
                Pick a different calendar
              </button>
            </>
          )}
        </div>
      </dialog>,
      document.body,
      )}
    </div>
  )
}
