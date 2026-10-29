import { ExternalLink, Mail, MessageCircle, MessageSquare } from 'lucide-react'
import { channelFor } from '../../lib/channels'
import { buildEmailUrl, buildSmsUrl, buildWhatsAppUrl, draftToText, EMAIL_PROVIDERS } from '../../lib/share'
import type { Draft } from '../../types/draft'
import { SentPrompt } from '../record/SentPrompt'
import { useEmailProvider } from '../record/useEmailProvider'
import { useSendPrompt } from '../record/useSendPrompt'

interface SendLinkProps {
  draft: Draft
  /** Called when the person confirms, on coming back, that it went out. */
  onSent: () => void
}

/** The button that takes a saved draft to where it is sent: their mail app, WhatsApp, messages or the social app. */
export function SendLink({ draft, onSent }: SendLinkProps) {
  const [emailProvider] = useEmailProvider()
  const sendPrompt = useSendPrompt()
  const channel = channelFor(draft.category)

  let href: string | undefined
  let label = ''
  let icon = <ExternalLink className="size-4" aria-hidden="true" />
  let newTab = true
  let copyFirst = false

  switch (channel.kind) {
    case 'mail':
      href = buildEmailUrl(emailProvider, draft)
      label = `Open in ${EMAIL_PROVIDERS.find((p) => p.id === emailProvider)?.label ?? 'mail'}`
      icon = <Mail className="size-4" aria-hidden="true" />
      newTab = emailProvider !== 'default'
      break
    case 'chat':
      if (draft.category === 'WHATSAPP') {
        href = buildWhatsAppUrl(draft)
        label = 'Send on WhatsApp'
        icon = <MessageCircle className="size-4" aria-hidden="true" />
      } else {
        href = buildSmsUrl(draft)
        label = 'Open in messages'
        icon = <MessageSquare className="size-4" aria-hidden="true" />
        newTab = false
      }
      break
    case 'social':
      href = channel.appUrl
      label = `Copy & open ${channel.label}`
      copyFirst = true
      break
    case 'note':
      break
  }

  if (!href) return null

  return (
    <>
      <a
        href={href}
        target={newTab ? '_blank' : undefined}
        rel="noopener noreferrer"
        onClick={() => {
          if (copyFirst) void navigator.clipboard?.writeText(draftToText(draft)).catch(() => undefined)
          sendPrompt.begin()
        }}
        className="btn btn-channel"
      >
        {icon}
        {label}
      </a>
      {sendPrompt.asking && (
        <SentPrompt
          recipient={draft.recipient}
          onSent={() => {
            sendPrompt.close()
            onSent()
          }}
          onNotYet={sendPrompt.close}
        />
      )}
    </>
  )
}
