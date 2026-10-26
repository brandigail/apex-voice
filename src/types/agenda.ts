/** One thing on the user's schedule: typed in Apex (or dictated to the assistant) or read from their linked calendar. */
export interface AgendaItem {
  /** Calendar events get a synthetic id; only Apex items can be deleted. */
  id: string
  title: string
  /** ISO 8601, always with an offset. */
  startsAt: string
  endsAt: string | null
  notes: string
  /** True for all-day calendar events, which have no meaningful clock time. */
  allDay: boolean
  /** "draft" items are saved drafts with a planned send time that are not sent yet. */
  source: 'apex' | 'calendar' | 'draft'
}

export interface AgendaResponse {
  items: AgendaItem[]
  /** Set when a calendar link exists but could not be read, so the screen can say so instead of looking empty. */
  calendarError: string | null
  calendarLinked: boolean
}

export interface NewAgendaItem {
  title: string
  startsAt: string
  endsAt: string | null
  notes: string
}

/** What the "test this calendar link" check found. */
export interface CalendarCheckResponse {
  ok: boolean
  error: string | null
  /** Events in the next 30 days. */
  count: number
  next: { title: string; startsAt: string; allDay: boolean }[]
}
