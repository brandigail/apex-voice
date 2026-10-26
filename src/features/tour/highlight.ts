const PULSE_MS = 6_000
const FIND_ATTEMPTS = 10
const FIND_EVERY_MS = 200

/** Scrolls a control into view and makes it glow for a few seconds. The control is found by its data-tour name. */
export function highlight(target: string): void {
  let attempts = 0
  const look = () => {
    const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
      element.classList.add('tour-pulse')
      window.setTimeout(() => element.classList.remove('tour-pulse'), PULSE_MS)
      return
    }
    // The new screen may still be loading; try again briefly.
    if (++attempts < FIND_ATTEMPTS) window.setTimeout(look, FIND_EVERY_MS)
  }
  look()
}

const key = (userId: string) => `apex-voice-tour-seen-${userId}`

/** Whether this person has already been through (or skipped) the tour on this device. */
export function hasSeenTour(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(userId: string): void {
  try {
    localStorage.setItem(key(userId), '1')
  } catch {
    // storage unavailable; the tour may open again next visit, which is harmless
  }
}
