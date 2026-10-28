import { useState, type FormEvent } from 'react'
import { buildSignature, profileFromUser } from '../../lib/profile'
import { MemorySection } from '../memory/MemorySection'
import { SubscriptionSection } from '../subscription/SubscriptionSection'
import { FeedbackForm } from '../tour/FeedbackForm'
import { AccountData } from './AccountData'
import { CalendarConnect } from './CalendarConnect'
import { authClient } from '../../lib/auth-client'
import { PROFILE_LIMITS, type Profile, type ProfileSource } from '../../types/profile'

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }

const fieldClass =
  'field'

interface TextFieldProps {
  id: string
  label: string
  value: string
  max: number
  onChange: (value: string) => void
  required?: boolean
  type?: string
  autoComplete?: string
  /** A short line of help under the field. */
  hint?: string
}

function TextField({ id, label, value, max, onChange, required, type = 'text', autoComplete, hint }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
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
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={fieldClass}
      />
      {hint && (
        <p id={`${id}-hint`} className="muted mt-1 text-xs">
          {hint}
        </p>
      )}
    </div>
  )
}

/** The form is keyed on the user id, so it initialises once from the stored profile and then owns its own edits. */
function ProfileForm({ initial, email }: { initial: Profile; email: string }) {
  const [profile, setProfile] = useState<Profile>(initial)
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })

  const set = (field: keyof Profile) => (value: string) => {
    setProfile((current) => ({ ...current, [field]: value }))
    setSave({ kind: 'idle' })
  }

  /** Saves the profile with a new calendar address ("" disconnects). Returns whether it worked. */
  const saveCalendar = async (calendarUrl: string): Promise<boolean> => {
    const next = profileFromUser({ ...profile, calendarUrl })
    try {
      const { error } = await authClient.updateUser(next)
      if (error) return false
      setProfile(next)
      return true
    } catch {
      return false
    }
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
    <form onSubmit={(e) => void handleSubmit(e)} data-tour="profile-form" className="surface mt-6 flex flex-col gap-4 p-6 text-left">
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
        label="Business name (optional)"
        hint="Not a business? Leave this blank and Apex will sign off with just your name."
        value={profile.businessName}
        max={PROFILE_LIMITS.businessName}
        onChange={set('businessName')}
        autoComplete="organization"
      />
      <TextField
        id="profile-role"
        label="Role or title (optional)"
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

      <CalendarConnect accountEmail={email} url={profile.calendarUrl} onChange={saveCalendar} />

      <div>
        <label htmlFor="profile-signature" className="mb-1.5 block text-sm font-semibold">
          Custom sign-off <span className="font-normal muted">(optional)</span>
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
        <p id="profile-signature-hint" className="mt-1 text-xs muted">
          Leave empty to build one from the details above. Anything you write here is used exactly as typed.
        </p>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Emails and quotes will end with</p>
        <pre
          aria-label="Signature preview"
          className="whitespace-pre-wrap rounded-xl border border-dashed border-(--line) bg-(--surface) p-3 font-sans text-sm"
        >
          {buildSignature(profileFromUser(profile)) || 'Add your name to see a preview.'}
        </pre>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={save.kind === 'saving' || !profile.name.trim()}
          className="btn btn-primary"
        >
          {save.kind === 'saving' ? 'Saving…' : 'Save profile'}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {save.kind === 'saved' && <span className="text-emerald-500">Saved</span>}
          {save.kind === 'error' && <span className="text-red-700 dark:text-red-400">{save.message}</span>}
        </p>
      </div>
    </form>
  )
}

interface ProfileViewProps {
  user: ProfileSource & { id: string; email: string }
  /** The subscription preview is only released to some accounts. */
  showSubscriptions: boolean
}

export function ProfileView({ user, showSubscriptions }: ProfileViewProps) {
  return (
    <section aria-labelledby="profile-heading">
      <h1 id="profile-heading" className="text-3xl font-extrabold tracking-tight">
        Your <span className="text-gradient">profile</span>
      </h1>
      <p className="mt-2 muted">
        Drafts are written in your name and signed for you, so you never have to dictate a sign-off. Signed in as{' '}
        <span className="font-semibold">{user.email}</span>.
      </p>
      <ProfileForm key={user.id} initial={profileFromUser(user)} email={user.email} />
      <MemorySection />
      {showSubscriptions && <SubscriptionSection />}

      <section aria-labelledby="feedback-heading" className="mt-10">
        <h2 id="feedback-heading" className="text-2xl font-extrabold tracking-tight">
          Tell us what you think
        </h2>
        <p className="muted mt-1 mb-4 text-sm">What is easy, what is slow, what is missing? Anything helps.</p>
        <FeedbackForm screen="profile" id="profile-feedback" />
      </section>

      <AccountData />
    </section>
  )
}
