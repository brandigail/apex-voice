import { useState, type FormEvent } from 'react'
import { buildSignature, profileFromUser } from '../../lib/profile'
import { authClient } from '../../lib/auth-client'
import { PROFILE_LIMITS, type Profile, type ProfileSource } from '../../types/profile'

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900'

interface TextFieldProps {
  id: string
  label: string
  value: string
  max: number
  onChange: (value: string) => void
  required?: boolean
  type?: string
  autoComplete?: string
}

function TextField({ id, label, value, max, onChange, required, type = 'text', autoComplete }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={max}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
    </div>
  )
}

/** The form is keyed on the user id, so it initialises once from the stored profile and then owns its own edits. */
function ProfileForm({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState<Profile>(initial)
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })

  const set = (field: keyof Profile) => (value: string) => {
    setProfile((current) => ({ ...current, [field]: value }))
    setSave({ kind: 'idle' })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next = profileFromUser(profile)
    setSave({ kind: 'saving' })
    try {
      const { error } = await authClient.updateUser(next)
      if (error) {
        setSave({ kind: 'error', message: error.message ?? 'Could not save your profile. Please try again.' })
        return
      }
      setProfile(next)
      setSave({ kind: 'saved' })
    } catch {
      setSave({ kind: 'error', message: 'Network error. Check your connection and try again.' })
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-4 text-left">
      <TextField
        id="profile-name"
        label="Your name"
        value={profile.name}
        max={PROFILE_LIMITS.name}
        onChange={set('name')}
        required
        autoComplete="name"
      />
      <TextField
        id="profile-business"
        label="Business name"
        value={profile.businessName}
        max={PROFILE_LIMITS.businessName}
        onChange={set('businessName')}
        autoComplete="organization"
      />
      <TextField
        id="profile-role"
        label="Role or title"
        value={profile.role}
        max={PROFILE_LIMITS.role}
        onChange={set('role')}
        autoComplete="organization-title"
      />
      <TextField
        id="profile-phone"
        label="Phone"
        type="tel"
        value={profile.phone}
        max={PROFILE_LIMITS.phone}
        onChange={set('phone')}
        autoComplete="tel"
      />

      <div>
        <label htmlFor="profile-signature" className="mb-1 block text-sm font-medium">
          Custom sign-off <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
        </label>
        <textarea
          id="profile-signature"
          value={profile.signature}
          maxLength={PROFILE_LIMITS.signature}
          rows={4}
          onChange={(e) => set('signature')(e.target.value)}
          aria-describedby="profile-signature-hint"
          className={`${fieldClass} resize-y`}
        />
        <p id="profile-signature-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Leave empty to build one from the details above. Anything you write here is used exactly as typed.
        </p>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Emails and quotes will end with</p>
        <pre
          aria-label="Signature preview"
          className="whitespace-pre-wrap rounded-lg border border-dashed border-slate-300 bg-slate-100 p-3 font-sans text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {buildSignature(profileFromUser(profile)) || 'Add your name to see a preview.'}
        </pre>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={save.kind === 'saving' || !profile.name.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
        >
          {save.kind === 'saving' ? 'Saving…' : 'Save profile'}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {save.kind === 'saved' && <span className="text-green-700 dark:text-green-400">Saved</span>}
          {save.kind === 'error' && <span className="text-red-700 dark:text-red-400">{save.message}</span>}
        </p>
      </div>
    </form>
  )
}

export function ProfileView({ user }: { user: ProfileSource & { id: string; email: string } }) {
  return (
    <section aria-labelledby="profile-heading">
      <h1 id="profile-heading" className="text-2xl font-bold">
        Your profile
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Drafts are written in your name and signed for you, so you never have to dictate a sign-off. Signed in as{' '}
        <span className="font-medium text-slate-900 dark:text-slate-100">{user.email}</span>.
      </p>
      <ProfileForm key={user.id} initial={profileFromUser(user)} />
    </section>
  )
}
