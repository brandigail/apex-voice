# Apex Voice: Voice Dictation and Draft Sync PWA (REBUILD FROM SCRATCH)

Read the portfolio-root `CLAUDE.md` first for global rules. This file is the brief for this project.

## What it is
A zero-cost installable PWA. You record a voice note, it is transcribed, then structured into a ready-to-send draft (email, quote, SMS or note) that syncs across devices. The old version is broken; don't reuse its code.

## Stack
React, Vite, TypeScript strict, Tailwind CSS v4 (`@tailwindcss/vite`), lucide-react, `vite-plugin-pwa`, `@neondatabase/serverless` (Neon Postgres), Better Auth, Netlify Functions. AI is Groq only (no Gemini).

## Serverless backend (`/netlify/functions`)
- `transcribe.ts`: receives audio, calls Groq Whisper `whisper-large-v3-turbo`, returns text.
- `generate.ts`: sends the transcript to a current Groq-hosted LLM (check Groq docs for the model name) with JSON mode and returns a validated draft.
- `db-sync.ts`: list, upsert and delete drafts in Neon.

## MVP (build first)
1. Recorder hook (`useAudioRecorder`) using the MediaRecorder API with mic permission handling, a live timer and a clear error state.
2. Record, then transcribe, then structure into a draft, shown in an editable card (category, recipient, subject, body) with copy and "open in mail/SMS" actions.
3. Draft history persisted in Neon via `db-sync.ts`, with a PWA update prompt banner (`vite-plugin-pwa` in prompt mode).

## Phase 2
Offline queue (record offline, process when back online), search and filter drafts, re-generate with a different tone.

## Strict draft JSON (validate with zod on both client and function)
```json
{ "category": "EMAIL | QUOTE | SMS | NOTE", "recipient": "string", "subject": "string", "body": "string" }
```
`types/`: `Draft { id, category, recipient, subject, body, transcript, createdAt, updatedAt }`.

## Rules specific to this project
- API keys (`GROQ_API_KEY`, `DATABASE_URL`) exist only in Netlify function env, never in the client bundle.
- MediaRecorder timeslice chunks are NOT independently decodable audio. Record the whole clip and send the complete blob on stop. Cap clips at about 60 seconds so the base64 body stays under Netlify's 6 MB request limit; show the limit in the UI.
- Access control (changed from the original shared-passcode design): email + password accounts with Better Auth on Neon. Every function requires a valid session cookie. Sign-up is open, so each user gets per-user rate limiting and a daily quota to protect the Groq quota. Drafts are scoped to the signed-in user.
- Each user has a profile (display name, business name, role, phone, sign-off). `generate` uses it so drafts are written in their name and end with their sign-off.
- "Send from Apex" (Gmail API or Resend) is Phase 2. For now drafts open in the user's mail app (default, Gmail, Outlook or Yahoo) or SMS.
- iOS Safari needs a user gesture to start recording and may output mp4 rather than webm; detect the supported mime type.
- Provide `tailwindcss` v4 setup via the Vite plugin (no `tailwind.config.js` or PostCSS needed).

## Start here
1. Ask me for my `GROQ_API_KEY` and Neon `DATABASE_URL`; put them in `.env.local` and Netlify env, never in chat output or git.
2. Run `netlify dev` for local function testing.
3. Work through `PLAN.md` from step 1.
