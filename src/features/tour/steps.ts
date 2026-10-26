import { CalendarDays, Globe2, History, Mic, MessageSquareHeart, ShieldCheck, Sparkles, Timer, UserRound, type LucideIcon } from 'lucide-react'
import type { Tab } from '../../components/TabBar'

export interface TourStep {
  id: string
  title: string
  /** One sentence that says what this part is for. */
  summary: string
  icon: LucideIcon
  /** Gradient for the step's icon tile. */
  from: string
  to: string
  points: readonly string[]
  /** Sentences the user can say to try it out. */
  tryIt?: readonly string[]
  /** The screen the "Show me" button opens, and the control it highlights there (a data-tour attribute value). */
  show?: { tab: Tab; target: string; label: string }
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Apex Voice',
    summary: 'Talk instead of type. Apex turns what you say into a finished message, and keeps track of your day.',
    icon: Sparkles,
    from: '#6366f1',
    to: '#d946ef',
    points: [
      'Record a message for email, a quote, WhatsApp, SMS or a social post.',
      'Talk to your assistant while you work. It answers you out loud.',
      'Everything you make is saved in your own private history.',
      'This tour takes about two minutes. You can reopen it any time with the "?" button at the top.',
    ],
  },
  {
    id: 'record',
    title: 'Record a message',
    summary: 'Say what you want to send. Apex writes it properly.',
    icon: Mic,
    from: '#22c55e',
    to: '#14b8a6',
    points: [
      '1. Pick where it is going: Email, Quote, WhatsApp, SMS… Apex writes it in the right style. WhatsApp is a friendly chat message, an email gets a subject line and your signature.',
      '2. Tap the big round button and speak. You can talk for up to 5 minutes and pause whenever you like.',
      '3. Tap it again to stop. In a few seconds your draft appears. Change anything you want.',
      '4. Send it with "Open in mail", WhatsApp or SMS, or tap Copy.',
    ],
    tryIt: ['Quote for Mrs Jones. Tile her kitchen floor, fifteen square metres at four hundred rand a square metre.', 'Tell Sam I will be there at eight.'],
    show: { tab: 'record', target: 'channels', label: 'Show me where to start' },
  },
  {
    id: 'language',
    title: 'Speak one language, send another',
    summary: 'Great for clients who speak a different language to you.',
    icon: Globe2,
    from: '#38bdf8',
    to: '#3b82f6',
    points: [
      'Under the record button, "I will speak" tells Apex which language you are using. Naming it, for example Afrikaans, makes it hear you much better.',
      '"Write it in" is the language of the finished message. Speak English and send Afrikaans, or the other way round. Names and prices stay exactly as you said them.',
      'The sign-off changes too, for example "Vriendelike groete".',
      'Zulu and Xhosa can be written but not understood when spoken yet.',
    ],
    show: { tab: 'record', target: 'languages', label: 'Show me the language boxes' },
  },
  {
    id: 'later',
    title: 'Keep it for the right time',
    summary: 'Recorded a quote at 6 am that must go out at 10? Save it and send it then.',
    icon: Timer,
    from: '#f59e0b',
    to: '#f97316',
    points: [
      'Every draft is saved automatically. You will find it in History.',
      'Set a "Send at" time on a draft. It then shows on your Agenda as a reminder, and turns red if it is overdue.',
      'Apex never sends anything by itself. You press send when you are ready.',
      'Tap "Mark as sent" once it has gone. Then the assistant can tell you what is still waiting, and you can look at the "To send" list in History.',
    ],
    show: { tab: 'history', target: 'history-tabs', label: 'Show me History' },
  },
  {
    id: 'assistant',
    title: 'Your hands-free assistant',
    summary: 'Just talk. It waits until you have finished, then answers out loud.',
    icon: Sparkles,
    from: '#6366f1',
    to: '#8b5cf6',
    points: [
      'Tap the glowing circle, allow the microphone, and speak naturally. Take your time: it only answers once you stop.',
      'It can tell you what is on your agenda, check whether you already sent a quote, write a draft, add a meeting or set a send time.',
      'After it writes something it asks, "Would you like me to read you back your draft?" Say yes or no.',
      'Tap the circle while it is talking to interrupt, or while you are talking to say "I am done".',
      'Keep the screen on and the app open while you talk. (Phones cannot listen while locked. The Android app can.)',
    ],
    tryIt: ['What is on my agenda today?', 'Did I already send Mr Smith his quote?', 'Write a quote for Mrs Jones to paint two bedrooms.', 'Add a meeting with the supplier tomorrow at ten.'],
    show: { tab: 'assistant', target: 'assistant-orb', label: 'Show me the assistant' },
  },
  {
    id: 'agenda',
    title: 'Your agenda',
    summary: 'Your meetings and reminders in one place.',
    icon: CalendarDays,
    from: '#38bdf8',
    to: '#6366f1',
    points: [
      'Add things by typing here, or just tell the assistant "add a meeting tomorrow at ten".',
      'Connect your own calendar in Profile (Google, Outlook or Apple) and your real meetings appear here, in blue.',
      'Drafts with a "Send at" time appear here too, in orange.',
    ],
    show: { tab: 'agenda', target: 'agenda-add', label: 'Show me the agenda' },
  },
  {
    id: 'history',
    title: 'History',
    summary: 'Everything you have made, and everything you have said to the assistant.',
    icon: History,
    from: '#a855f7',
    to: '#ec4899',
    points: [
      'Drafts: search by a name, or filter by type. "To send" shows what is waiting, soonest first. "Sent" shows what has gone.',
      'Tap a draft to read it, copy it, change when to send it, or delete it.',
      'Conversations: everything you have said to the assistant, in case you want to look back.',
    ],
    show: { tab: 'history', target: 'history-tabs', label: 'Show me History' },
  },
  {
    id: 'profile',
    title: 'Make it yours',
    summary: 'A minute here makes every message sound like you.',
    icon: UserRound,
    from: '#f43f5e',
    to: '#d946ef',
    points: [
      'Your name, phone and business are used to sign your emails and quotes. The business name is optional if you are not a business.',
      'Connect your calendar, and choose how the assistant sounds. Try the voices with "Hear it" on the Assistant screen.',
      'The sun and moon at the top switch between light and dark.',
    ],
    show: { tab: 'profile', target: 'profile-form', label: 'Show me my profile' },
  },
  {
    id: 'privacy',
    title: 'Your information',
    summary: 'What happens to what you say.',
    icon: ShieldCheck,
    from: '#10b981',
    to: '#14b8a6',
    points: [
      'Only you can see your drafts, agenda and conversations.',
      'Your recordings are not saved. Your words are sent to an AI service to be turned into text and written up.',
      'Nothing is sent to anyone until you press send in your own mail, WhatsApp or messages app.',
    ],
  },
  {
    id: 'feedback',
    title: 'Tell us what you think',
    summary: 'You are one of the first people to use this, so your opinion really matters.',
    icon: MessageSquareHeart,
    from: '#f472b6',
    to: '#f43f5e',
    points: ['What was easy? What was slow or confusing? What is missing? Write anything below, even one line.'],
  },
]
