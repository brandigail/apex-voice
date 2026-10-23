import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { usePasscode } from '../../providers/usePasscode'

export function PasscodeGate() {
  const { rejected, save } = usePasscode()
  const [value, setValue] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (trimmed) save(trimmed)
  }

  return (
    <section aria-labelledby="gate-heading" className="mx-auto max-w-sm text-center">
      <Lock className="mx-auto size-8 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
      <h1 id="gate-heading" className="mt-3 text-2xl font-bold">
        Enter passcode
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">This app is private. Enter the shared passcode to continue.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 text-left">
        <label htmlFor="passcode" className="text-sm font-medium">
          Passcode
        </label>
        <input
          id="passcode"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="current-password"
          aria-invalid={rejected}
          aria-describedby={rejected ? 'passcode-error' : undefined}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900"
        />
        {rejected && (
          <p id="passcode-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
            That passcode was not accepted. Check it and try again.
          </p>
        )}
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
        >
          Continue
        </button>
      </form>
    </section>
  )
}
