import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, CheckCheck, Copy, ExternalLink, Mail, MessageCircle, MessageSquare, Send, Share2 } from 'lucide-react'
import { ChannelIcon } from '../../components/ChannelIcon'
import { bodyLabel, channelFor, hasRecipient, hasSubject, subjectLabel } from '../../lib/channels'
import {
  EMAIL_PROVIDERS,
  buildEmailUrl,
  buildSmsUrl,
  buildWhatsAppUrl,
  draftToText,
  isInternationalNumber,
  type EmailProvider,
} from '../../lib/share'
import type { GeneratedDraft } from '../../types/draft'
import type { SaveStatus } from './useDraftAutosave'
import { updateDraftStatus } from '../../lib/drafts-api'
import { reportActivity } from '../../lib/activity-api'
import { languageName } from '../../types/languages'
import { SendAtField } from '../history/SendAtField'
import { useEmailProvider } from './useEmailProvider'
import type { VoiceNoteResult } from './useVoiceNote'

interface DraftCardProps {
  result: VoiceNoteResult
  onChange: (patch: Partial<GeneratedDraft>) => void
  saveStatus: SaveStatus
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved to history',
  error: 'Could not save to history. Your edits are still here; keep editing to retry.',
}

type CopyState = 'idle' | 'copied' | 'failed'

const labelClass = 'mb-1.5 block text-sm font-semibold'

export function DraftCard({ result, onChange, saveStatus }: DraftCardProps) {
  const { draft, transcript } = result
  const channel = channelFor(draft.category)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [sent, setSent] = useState(false)
  const [sendAt, setSendAt] = useState<string | null>(null)
  const resetTimer = useRef<number | null>(null)
  /** The text as Apex first wrote it, so the tester's own changes show how they would have said it. */
  const [original] = useState(() => ({ body: draft.body, subject: draft.subject }))

  /** Records what the tester did with the draft, with the final wording next to the first version. */
  const reportAction = (action: string) =>
    reportActivity('draft_action', {
      action,
      category: draft.category,
      recipient: draft.recipient,
      subject: draft.subject,
      body: draft.body,
      edited: draft.body !== original.body || draft.subject !== original.subject,
      firstBody: draft.body !== original.body ? original.body : undefined,
      firstSubject: draft.subject !== original.subject ? original.subject : undefined,
    })
  const [emailProvider, setEmailProvider] = useEmailProvider()
  const providerLabel = EMAIL_PROVIDERS.find((p) => p.id === emailProvider)?.label ?? 'mail'

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    },
    [],
  )

  const canSend = draft.body.trim().length > 0
  const isMail = channel.kind === 'mail'
  const isSocial = channel.kind === 'social'
  const canNativeShare = typeof navigator.share === 'function'
  const whatsappNeedsNumber =
    draft.category === 'WHATSAPP' && draft.recipient.trim() !== '' && !isInternationalNumber(draft.recipient)

  const handleCopy = async () => {
    reportAction('copy')
    try {
      await navigator.clipboard.writeText(draftToText(draft))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2000)
  }

  /** Remembers that this one went out, so the assistant can answer "did I already send it?". */
  const handleSent = async () => {
    const next = !sent
    reportAction(next ? 'mark_sent' : 'unmark_sent')
    setSent(next)
    try {
      await updateDraftStatus(result.id, { sent: next })
    } catch {
      setSent(!next)
    }
  }

  /** Plans when this will be sent; it then appears on the agenda until it is marked as sent. */
  const handleSendAt = async (next: string | null) => {
    const previous = sendAt
    setSendAt(next)
    try {
      await updateDraftStatus(result.id, { sendAt: next })
    } catch {
      setSendAt(previous)
    }
  }

  /** Opens the device share sheet, which lists every installed mail, chat and notes app. */
  const handleShare = async () => {
    reportAction('share')
    try {
      await navigator.share({ title: draft.subject || undefined, text: draftToText(draft) })
    } catch {
      // dismissed by the user, or sharing isn't allowed right now
    }
  }

  const linkButton = (href: string | undefined, label: string, icon: React.ReactNode, external: boolean) => (
    <a
      href={canSend ? href : undefined}
      target={external ? '_blank' : undefined}
      rel="noopener noreferrer"
      aria-disabled={!canSend}
      onClick={() => reportAction(`open_${label}`)}
      className="btn btn-channel"
    >
      {icon}
      {label}
    </a>
  )

  return (
    <article
      aria-label="Draft"
      style={{ '--c1': channel.from, '--c2': channel.to } as CSSProperties}
      className="surface animate-rise w-full overflow-hidden text-left"
    >
      <div className="h-1 bg-linear-to-r from-(--c1) to-(--c2)" aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-(--c1) to-(--c2) text-white shadow-md">
            <ChannelIcon category={draft.category} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-tight font-bold">
              Your {channel.label} draft
              {draft.language !== 'en' && (
                <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 align-middle text-xs font-semibold text-sky-500">
                  {languageName(draft.language)}
                </span>
              )}
            </h2>
            <p role="status" aria-live="polite" className={`text-xs ${saveStatus === 'error' ? 'text-red-500' : 'muted'}`}>
              {SAVE_LABEL[saveStatus] || 'Edit anything before you send'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {hasRecipient(channel) && (
            <div>
              <label htmlFor="draft-recipient" className={labelClass}>
                To
              </label>
              <input
                id="draft-recipient"
                type="text"
                value={draft.recipient}
                onChange={(e) => onChange({ recipient: e.target.value })}
                placeholder={
                  isMail
                    ? 'Email address or name'
                    : draft.category === 'WHATSAPP'
                      ? 'Number with country code, e.g. +27 82 123 4567'
                      : 'Phone number or name'
                }
                autoComplete="off"
                className="field"
              />
              {whatsappNeedsNumber && (
                <p className="muted mt-1.5 text-xs">
                  Add the number with its country code (+27…) to open that chat directly. Otherwise WhatsApp will let
                  you pick the contact.
                </p>
              )}
            </div>
          )}

          {hasSubject(channel) && (
            <div>
              <label htmlFor="draft-subject" className={labelClass}>
                {subjectLabel(channel)}
              </label>
              <input
                id="draft-subject"
                type="text"
                value={draft.subject}
                onChange={(e) => onChange({ subject: e.target.value })}
                className="field"
              />
            </div>
          )}

          <div>
            <label htmlFor="draft-body" className={labelClass}>
              {bodyLabel(channel)}
            </label>
            <textarea
              id="draft-body"
              value={draft.body}
              onChange={(e) => onChange({ body: e.target.value })}
              rows={isSocial || isMail ? 10 : 6}
              className="field resize-y leading-relaxed"
            />
          </div>

          <SendAtField id="draft-send-at" value={sendAt} sent={sent} disabled={saveStatus !== 'saved'} onChange={(next) => void handleSendAt(next)} />

          {isMail && (
            <div>
              <label htmlFor="draft-mail-app" className={labelClass}>
                Email app
              </label>
              <select
                id="draft-mail-app"
                value={emailProvider}
                onChange={(e) => setEmailProvider(e.target.value as EmailProvider)}
                className="field"
              >
                {EMAIL_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isMail &&
              linkButton(
                buildEmailUrl(emailProvider, draft),
                `Open in ${providerLabel}`,
                <Mail className="size-4" aria-hidden="true" />,
                emailProvider !== 'default',
              )}
            {draft.category === 'WHATSAPP' &&
              linkButton(
                buildWhatsAppUrl(draft),
                'Send on WhatsApp',
                <MessageCircle className="size-4" aria-hidden="true" />,
                true,
              )}
            {draft.category === 'SMS' &&
              linkButton(buildSmsUrl(draft), 'Open in messages', <MessageSquare className="size-4" aria-hidden="true" />, false)}
            {isSocial && channel.appUrl && (
              <a
                href={canSend ? channel.appUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canSend}
                onClick={() => void handleCopy()}
                className="btn btn-channel"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Copy &amp; open {channel.label}
              </a>
            )}

            <button type="button" onClick={() => void handleCopy()} disabled={!canSend} className="btn btn-ghost">
              {copyState === 'copied' ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
            </button>

            {draft.category === 'QUOTE' && (
              <a
                href={canSend ? buildWhatsAppUrl(draft) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canSend}
                onClick={() => reportAction('open_quote_whatsapp')}
                className="btn btn-ghost"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => void handleSent()}
              disabled={saveStatus !== 'saved'}
              aria-pressed={sent}
              className="btn btn-ghost"
            >
              {sent ? <CheckCheck className="size-4 text-emerald-500" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              {sent ? 'Marked as sent' : 'Mark as sent'}
            </button>
            {canNativeShare && (
              <button type="button" onClick={() => void handleShare()} disabled={!canSend} className="btn btn-ghost">
                <Share2 className="size-4" aria-hidden="true" />
                Share…
              </button>
            )}
          </div>
        </div>

        <details className="muted mt-5 text-sm">
          <summary>What we heard (transcript)</summary>
          <p className="mt-2 whitespace-pre-wrap">{transcript}</p>
        </details>
      </div>
    </article>
  )
}
