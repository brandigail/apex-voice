import { useEffect, useState } from 'react'
import { reportActivity } from '../../lib/activity-api'

const isIphone = /iPhone|iPad|iPod/.test(navigator.userAgent)
const isInstalled = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches

/** Plain-language explanation for a tester whose use is being recorded. */
export function TesterNotice() {
  return (
    <section aria-labelledby="tester-heading" className="surface mt-6 p-5 text-left">
      <h2 id="tester-heading" className="text-lg font-bold">
        You are a tester
      </h2>
      <p className="muted mt-1 text-sm">
        While you test, Apex keeps a private record of what you say, the drafts it writes and any errors, so Brandon can
        find and fix problems and make drafts sound more like you. Nobody else can see it. Please never say bank or card
        numbers.
      </p>
    </section>
  )
}

/** On an iPhone opened in a browser, explains how to put Apex on the home screen (only Safari can do it). */
export function InstallHelp() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open) reportActivity('install_hint', { shown: true })
  }, [open])
  if (!isIphone || isInstalled) return null
  return (
    <section aria-labelledby="install-heading" className="surface mt-6 p-5 text-left">
      <h2 id="install-heading" className="text-lg font-bold">
        Put Apex on your iPhone
      </h2>
      <p className="muted mt-1 text-sm">Apex installs from Safari, not from other browsers.</p>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn btn-ghost mt-3">
        {open ? 'Hide steps' : 'Show steps'}
      </button>
      {open && (
        <ol className="muted mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>Copy this page&apos;s address.</li>
          <li>Open Safari and paste the address.</li>
          <li>Tap the Share button (square with an arrow).</li>
          <li>Tap Add to Home Screen, then Add.</li>
          <li>Open Apex from your home screen and sign in once.</li>
        </ol>
      )}
    </section>
  )
}
