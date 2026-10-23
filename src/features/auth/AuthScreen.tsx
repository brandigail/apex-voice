import { useState, type FormEvent } from 'react'
import { AudioWaveform, Eye, EyeOff } from 'lucide-react'
import { authClient } from '../../lib/auth-client'

type Mode = 'sign-in' | 'sign-up'

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const signingUp = mode === 'sign-up'

  const switchMode = () => {
    setMode(signingUp ? 'sign-in' : 'sign-up')
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: authError } = signingUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password })
      // On success the session hook updates and App swaps this screen for the app.
      if (authError) setError(authError.message ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="auth-heading" className="mx-auto max-w-sm text-center">
      <AudioWaveform className="mx-auto size-8 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
      <h1 id="auth-heading" className="mt-3 text-2xl font-bold">
        {signingUp ? 'Create your account' : 'Sign in'}
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        {signingUp ? 'Drafts will be written in your name.' : 'Welcome back to Apex Voice.'}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-4 text-left">
        {signingUp && (
          <div>
            <label htmlFor="auth-name" className="mb-1 block text-sm font-medium">
              Your name
            </label>
            <input
              id="auth-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              className={fieldClass}
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              minLength={8}
              required
              aria-describedby={signingUp ? 'auth-password-hint' : undefined}
              className={`${fieldClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </button>
          </div>
          {signingUp && (
            <p id="auth-password-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              At least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
        {signingUp ? 'Already have an account?' : 'New here?'}{' '}
        <button
          type="button"
          onClick={switchMode}
          className="font-medium text-indigo-600 underline hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-200"
        >
          {signingUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </section>
  )
}
