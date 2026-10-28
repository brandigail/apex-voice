# Apex Voice: Build Plan

- [x] 1. Scaffold Vite React TS, Tailwind v4 plugin, lucide-react, zod, `.env.example`, `.gitignore`, `netlify.toml`
- [x] 2. Provider setup in `main.tsx`; layout, theme, mobile-first shell
- [x] 3. Neon schema (`drafts` table) and a migration script
- [x] 4. `types/` (Draft, DraftCategory) and a shared zod schema
- [x] 5. `useAudioRecorder` hook: permission, start/stop, timer, mime detection, 60s cap
- [x] 6. `netlify/functions/transcribe.ts` (Groq Whisper) with passcode check and size limits
- [x] 7. `netlify/functions/generate.ts` (Groq LLM, JSON mode, zod validation, one retry on invalid JSON)
- [x] 8. Record screen UI: record button, timer, processing states, error handling
- [x] 9. Editable draft card with copy, mailto and sms actions (plus Gmail, Outlook and Yahoo compose links)
- [x] 10. Accounts: Better Auth (email + password) on Neon; sign up, sign in, sign out UI; functions check the session cookie instead of the shared passcode
- [x] 11. Profile and sign-off: display name, business name, role, phone, signature; settings screen; `generate` writes drafts in the user's name and sign-off
- [x] 12. Per-user rate limiting and daily quota on `transcribe` and `generate` (sign-up is open, so protect the Groq quota)
- [x] 13. `netlify/functions/db-sync.ts` (list, upsert, delete, scoped to the signed-in user) and a client sync layer
- [x] 14. Draft history screen with search and category filter
- [x] 15. PWA: manifest, icons in `/public`, `vite-plugin-pwa` prompt-for-update banner, offline shell
- [ ] 16. Test the full flow on desktop Chrome and a real phone (iOS Safari and Android Chrome)
- [ ] 17. Build, lint and `tsc --noEmit` clean; no console errors
- [x] 18. README (pitch, architecture diagram, features, recruiter demo bullets)
- [~] 19. Deploy to Netlify with env vars; test live; push to GitHub; update root `LINKS.md`

## Voice assistant (added 2026-10-26)
- [x] A1. Channel picker before recording (email, quote, WhatsApp, SMS, Instagram, Facebook, TikTok, note) and a redesign
- [x] A2. `assistant` function with tool calling: agenda, drafts, sent state, create draft; own model and token budget
- [x] A3. `speak` function (Groq Orpheus voice) with browser-voice fallback; hands-free listener with silence detection
- [x] A4. Agenda tab (Apex items plus linked iCal calendar) and "Mark as sent"
- [x] A5. Groq accepts the Orpheus terms (console), then tune the voice and reply speed on the live site
- [x] A6. Android app (Capacitor shell, foreground microphone service, signed release APK); iPhone stays on the web app

## Round 3 (2026-10-26)
- [x] B1. Diana as the default voice; business name optional
- [x] B2. "Send at" reminders, To send / Sent filter, planned sends on the agenda, assistant tool schedule_send
- [x] B3. Assistant conversation history (Conversations tab)
- [x] B4. Calendar pop-up for Google / Outlook / Apple with paste and test
- [x] B5. Recordings up to 5 minutes; spoken and written language settings (Afrikaans, Spanish, others, translation)
- [x] B6. Subscriptions preview (owner account only) with live exchange rates
- [x] B7a. PayFast sandbox: signed checkout, payment notifications (ITN), subscription status, cancel, confirmation email (needs RESEND_API_KEY)
- [ ] B7b. Own PayFast sandbox merchant (signing and cancel through PayFast), then live merchant, privacy / terms / refund pages, per-plan limits
- [ ] B8. One-tap calendar sign-in with Google or Microsoft (needs OAuth credentials)

## Personal assistant memory (added 2026-10-28)
- [x] C1. `memories` and `contacts` tables (encrypted text, per user), store, REST functions and a "What Apex knows about you" section on the Profile tab
- [x] C2. Assistant tools `remember`, `save_contact`, `recall`, `forget`; relevant memory is added to the assistant prompt on every turn
- [x] C3. Drafts use preferences and saved people (recipient email or phone filled in from a saved contact)
- [ ] C4. Check on a real phone and with dad's real wording; tune the prompts
- [ ] C5. Learn writing style from edited, sent drafts
- [ ] C6. Morning briefing on the Assistant tab (today's meetings, overdue sends, unanswered drafts)
- [ ] C7. Inbox awareness (blocked on the SECURITY.md gaps and two-step login)

## Phase 2
- Send from inside Apex (Gmail API as the user, or Resend free tier with reply-to)
- Offline queue, re-generate with a different tone, team or shared business profiles
