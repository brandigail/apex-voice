import type { DraftCategory } from '../types/draft'

export type ChannelKind = 'mail' | 'chat' | 'social' | 'note'

export interface Channel {
  id: DraftCategory
  label: string
  /** One line shown under the picker, so people know what they will get. */
  hint: string
  kind: ChannelKind
  /** Gradient stops for the channel's icon tile and glow. */
  from: string
  to: string
  /** Where the "open app" button goes for social channels. */
  appUrl?: string
}

export const CHANNELS: readonly Channel[] = [
  { id: 'EMAIL', label: 'Email', hint: 'A polished email with a subject line and your signature.', kind: 'mail', from: '#6366f1', to: '#8b5cf6' },
  { id: 'QUOTE', label: 'Quote', hint: 'A priced quote with every item, quantity and total.', kind: 'mail', from: '#10b981', to: '#14b8a6' },
  { id: 'WHATSAPP', label: 'WhatsApp', hint: 'A friendly chat message. No subject, no formal sign-off.', kind: 'chat', from: '#22c55e', to: '#16a34a' },
  { id: 'SMS', label: 'SMS', hint: 'A short, plain text message.', kind: 'chat', from: '#38bdf8', to: '#3b82f6' },
  { id: 'INSTAGRAM', label: 'Instagram', hint: 'A caption with a hook, a call to action and hashtags.', kind: 'social', from: '#f59e0b', to: '#d946ef', appUrl: 'https://www.instagram.com/' },
  { id: 'FACEBOOK', label: 'Facebook', hint: 'A friendly post for your page or community.', kind: 'social', from: '#3b82f6', to: '#1d4ed8', appUrl: 'https://www.facebook.com/' },
  { id: 'TIKTOK', label: 'TikTok', hint: 'An on-screen hook, a punchy caption and hashtags.', kind: 'social', from: '#22d3ee', to: '#f43f5e', appUrl: 'https://www.tiktok.com/upload' },
  { id: 'NOTE', label: 'Note', hint: 'A tidy memo to yourself.', kind: 'note', from: '#f59e0b', to: '#f97316' },
]

const BY_ID = new Map(CHANNELS.map((channel) => [channel.id, channel]))

export function channelFor(id: DraftCategory): Channel {
  const channel = BY_ID.get(id)
  if (!channel) throw new Error(`Unknown channel: ${id}`)
  return channel
}

/** Social posts and notes have no recipient field. */
export function hasRecipient(channel: Channel): boolean {
  return channel.kind === 'mail' || channel.kind === 'chat'
}

/** Emails and quotes have a subject; TikTok has a separate on-screen hook. Every other channel is the body alone. */
export function hasSubject(channel: Channel): boolean {
  return channel.kind === 'mail' || channel.id === 'TIKTOK'
}

export function subjectLabel(channel: Channel): string {
  return channel.id === 'TIKTOK' ? 'On-screen hook' : 'Subject'
}

export function bodyLabel(channel: Channel): string {
  return channel.kind === 'social' ? 'Caption' : 'Message'
}
