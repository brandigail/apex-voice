import { FileText, Mail, MessageCircle, MessageSquare, StickyNote, type LucideProps } from 'lucide-react'
import type { DraftCategory } from '../types/draft'

type IconProps = Pick<LucideProps, 'className'>

/** lucide-react ships no brand logos, so these are simple hand-drawn marks that read clearly at small sizes. */
function Instagram({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Facebook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.6 21v-7.4h2.5l.4-3h-2.9V8.8c0-.9.3-1.4 1.5-1.4h1.5V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8.2v3h2.5V21z" />
    </svg>
  )
}

function TikTok({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 3h-2.9v11.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V8.9a5.6 5.6 0 1 0 4.7 5.5V9.2a6.9 6.9 0 0 0 4 1.3V7.6a4 4 0 0 1-4-4.1z" />
    </svg>
  )
}

const ICONS: Record<DraftCategory, (props: IconProps) => React.JSX.Element> = {
  EMAIL: ({ className }) => <Mail className={className} aria-hidden="true" />,
  QUOTE: ({ className }) => <FileText className={className} aria-hidden="true" />,
  WHATSAPP: ({ className }) => <MessageCircle className={className} aria-hidden="true" />,
  SMS: ({ className }) => <MessageSquare className={className} aria-hidden="true" />,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: TikTok,
  NOTE: ({ className }) => <StickyNote className={className} aria-hidden="true" />,
}

export function ChannelIcon({ category, className }: { category: DraftCategory; className?: string }) {
  const Icon = ICONS[category]
  return <Icon className={className} />
}
