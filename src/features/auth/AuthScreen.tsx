import { useState, type FormEvent } from 'react'
import { AudioWaveform, Eye, EyeOff } from 'lucide-react'
import { authClient } from '../../lib/auth-client'

type Mode = 'sign-in' | 'sign-up'

const fieldClass =
  'field'

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
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/40">
        <AudioWaveform className="size-8" aria-hidden="true" />
      </span>
      <h1 id="auth-heading" className="mt-5 text-3xl font-extrabold tracking-tight">
        {signingUp ? 'Create your account' : 'Sign in'}
      </h1>
      <p className="mt-2 muted">
        {signingUp ? 'Drafts will be written and signed in your name.' : 'Speak it once. Send it as an email, WhatsApp, SMS or social post.'}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="surface mt-6 flex flex-col gap-4 p-6 text-left">
        {signingUp && (
          <div>
            <label htmlFor="auth-name" className="mb-1.5 block text-sm font-semibold">
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
          <label htmlFor="auth-email" className="mb-1.5 block text-sm font-semibold">
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
          <label htmlFor="auth-password" className="mb-1.5 block text-sm font-semibold">
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
              className="muted absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg hover:text-(--ink)"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </button>
          </div>
          {signingUp && (
            <p id="auth-password-hint" className="mt-1 text-xs muted">
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
          className="btn btn-primary py-3"
        >
          {busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm muted">
        {signingUp ? 'Already have an account?' : 'New here?'}{' '}
        <button
          type="button"
          onClick={switchMode}
          className="font-semibold text-violet-500 underline hover:text-fuchsia-400"
        >
          {signingUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </section>
  )
}
