import { useState, type FormEvent } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { authClient } from '../../lib/auth-client'

/** Lets a person take a copy of everything Apex holds about them, or erase their account and all of it. */
export function AccountData() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch('/api/account-export')
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not prepare your data.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'apex-voice-my-data.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare your data.')
    } finally {
      setDownloading(false)
    }
  }

  const erase = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: failure } = await authClient.deleteUser({ password })
      // On success the account is gone and the session ends, so the app returns to the sign-in screen by itself.
      if (failure) setError(failure.message ?? 'Could not delete the account. Check your password and try again.')
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="data-heading" className="mt-10">
      <h2 id="data-heading" className="text-2xl font-extrabold tracking-tight">
        Your data
      </h2>
      <p className="muted mt-1 text-sm">Your recordings are never stored. This is about your drafts, conversations, agenda and profile.</p>

      <div className="surface mt-4 flex flex-col gap-4 p-5">
        <div>
          <button type="button" onClick={() => void download()} disabled={downloading} className="btn btn-ghost">
            <Download className="size-4" aria-hidden="true" />
            {downloading ? 'Preparing…' : 'Download my data'}
          </button>
          <p className="muted mt-2 text-xs">A single file with everything Apex holds about you, in a readable form.</p>
        </div>

        <div className="border-t border-(--line) pt-4">
          {deleting ? (
            <form onSubmit={(e) => void erase(e)} className="flex flex-col gap-3">
              <p className="text-sm">
                This permanently deletes your account and <strong>everything in it</strong>: drafts, conversations, agenda and profile. It cannot be undone. If you
                have a subscription, cancel it first.
              </p>
              <label htmlFor="delete-password" className="text-sm font-semibold">
                Type your password to confirm
              </label>
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="field"
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy || password.length === 0} className="btn border border-red-600 bg-red-600 text-white hover:bg-red-700">
                  <Trash2 className="size-4" aria-hidden="true" />
                  {busy ? 'Deleting…' : 'Delete everything'}
                </button>
                <button type="button" onClick={() => { setDeleting(false); setPassword(''); setError(null) }} className="btn btn-ghost">
                  Keep my account
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setDeleting(true)} className="btn btn-ghost text-red-600 dark:text-red-400">
              <Trash2 className="size-4" aria-hidden="true" />
              Delete my account and data
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
