import { useState, type CSSProperties } from 'react'
import { BellRing, Check, CheckCheck, ChevronDown, Copy, Send, Trash2 } from 'lucide-react'
import { ChannelIcon } from '../../components/ChannelIcon'
import { channelFor } from '../../lib/channels'
import { useNow } from '../../lib/useNow'
import { draftToText } from '../../lib/share'
import type { Draft, DraftStatusUpdate } from '../../types/draft'
import { languageName } from '../../types/languages'
import { SendAtField } from './SendAtField'
import { SendLink } from './SendLink'

interface DraftListItemProps {
  draft: Draft
  onDelete: (id: string) => Promise<boolean>
  onUpdateStatus: (id: string, update: DraftStatusUpdate) => Promise<void>
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const sendAtFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function DraftListItem({ draft, onDelete, onUpdateStatus }: DraftListItemProps) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const channel = channelFor(draft.category)
  const now = useNow()

  const title = draft.subject || draft.body.split('\n')[0] || draft.recipient || 'Untitled draft'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftToText(draft))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked; nothing useful to show beyond the button not changing
    }
  }

  return (
    <li
      style={{ '--c1': channel.from, '--c2': channel.to } as CSSProperties}
      className="surface animate-rise overflow-hidden hover:border-(--c1)/60"
    >
      <details className="group">
        <summary className="flex items-start gap-3 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-(--c1) to-(--c2) text-white shadow-md">
            <ChannelIcon category={draft.category} className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-wide uppercase" style={{ color: channel.from }}>
                {channel.label}
              </span>
              <span className="flex items-center gap-2">
                {draft.language !== 'en' && (
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-500">
                    {languageName(draft.language)}
                  </span>
                )}
                {!draft.sentAt && draft.sendAt && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      new Date(draft.sendAt).getTime() < now ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    <BellRing className="size-3" aria-hidden="true" />
                    {sendAtFormat.format(new Date(draft.sendAt))}
                  </span>
                )}
                {draft.sentAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCheck className="size-3" aria-hidden="true" />
                    Sent
                  </span>
                )}
                <time dateTime={draft.createdAt} className="muted text-xs">
                  {dateFormat.format(new Date(draft.createdAt))}
                </time>
              </span>
            </span>
            <span className="truncate font-semibold">{title}</span>
            {draft.recipient && <span className="muted truncate text-sm">To {draft.recipient}</span>}
            <span className="muted line-clamp-2 text-sm group-open:hidden">{draft.body}</span>
          </span>
          <ChevronDown className="muted mt-1 size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="border-t border-(--line) p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</p>
          <div className="mt-4">
            <SendAtField
              id={`send-at-${draft.id}`}
              value={draft.sendAt}
              sent={draft.sentAt !== null}
              onChange={(sendAt) => void onUpdateStatus(draft.id, { sendAt })}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!draft.sentAt && <SendLink draft={draft} onSent={() => void onUpdateStatus(draft.id, { sent: true })} />}

            <button type="button" onClick={() => void handleCopy()} className="btn btn-ghost">
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button type="button" onClick={() => void onUpdateStatus(draft.id, { sent: !draft.sentAt })} className="btn btn-ghost">
              <Send className="size-4" aria-hidden="true" />
              {draft.sentAt ? 'Mark as not sent' : 'Mark as sent'}
            </button>

            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={() => void onDelete(draft.id).then((ok) => !ok && setConfirming(false))}
                  className="btn border border-red-600 bg-red-600 text-white hover:bg-red-700"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Yes, delete
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost">
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn btn-ghost text-red-600 hover:bg-red-500/10! dark:text-red-400"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}
