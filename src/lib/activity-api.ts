/**
 * Reports what a tester did (a button pressed, an error shown) so the owner can see why something went wrong. The
 * server ignores these for every account that is not on the tester list, and a failure here is never shown.
 */
export type ClientActivity = 'session_start' | 'client_error' | 'draft_action' | 'screen' | 'install_hint'

export function reportActivity(kind: ClientActivity, detail: Record<string, unknown> = {}): void {
  void fetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, detail }),
    keepalive: true,
  }).catch(() => undefined)
}

/** How the app is being run, so "it doesn't work on my phone" can be matched to a device and install state. */
export function describeDevice(): Record<string, unknown> {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return {
    userAgent: navigator.userAgent,
    installed: iosStandalone || window.matchMedia('(display-mode: standalone)').matches,
    width: window.innerWidth,
    online: navigator.onLine,
  }
}
