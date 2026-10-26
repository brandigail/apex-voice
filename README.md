# Apex Voice

Talk to your business. Apex Voice turns a spoken note into a finished email, quote, WhatsApp, SMS or social post, and doubles as a hands-free voice assistant that knows your agenda and what you have already sent. It runs in the browser (installable PWA) and as an Android app.

**Live demo:** https://apex-voice-app.netlify.app

## What to demo to a recruiter
1. **Record for a channel.** Pick WhatsApp, Instagram, Quote and so on, say what you want, and get a draft written in that channel's style (a casual chat message, a caption with hashtags, a priced quote with your signature).
2. **Hands-free assistant.** Open the Assistant tab and talk. It waits until you stop speaking, answers out loud in a natural voice, and uses tools to check your agenda, search drafts ("did I already send Mr Smith his quote?"), write drafts and add meetings.
3. **Real mobile app.** The Android build keeps listening with the screen off through a native foreground service, which a browser cannot do.

## Features
- Voice to draft: Groq Whisper transcription, then Groq LLM with JSON mode validated by zod on the client and the server
- Eight channels: email, quote, WhatsApp, SMS, Instagram, Facebook, TikTok, note
- Voice assistant with tool calling (agenda, draft search, create draft, mark as sent), silence-based turn taking, spoken replies (Groq Orpheus) with a browser-voice fallback
- Agenda: items added in Apex or by voice, plus a read-only link to a private iCal calendar (Google, Outlook, Apple)
- Per-user accounts (Better Auth, email and password on Neon), profile and automatic signature, draft history with search, filter and "sent" tracking
- Send options: default mail app, Gmail, Outlook, Yahoo, SMS, WhatsApp, device share sheet
- PWA with update prompt, light and dark themes, Android app (Capacitor)
- Recordings up to 5 minutes (cut into 45 second clips, transcribed in parallel and joined), and any spoken language Whisper supports: Afrikaans, Spanish and more. A message can be spoken in one language and written in another (translation), with a matching sign-off
- "Send at" reminders: drafts can wait for the right time, appear on the agenda when due, and the history has a "To send" list; every assistant conversation is saved and listed by date
- Guided calendar linking (Google, Outlook, Apple) with a one-tap paste and a test before saving
- A subscription preview, switched on per account with `FEATURE_SUBSCRIPTIONS`: plans with live currency conversion and PayFast checkout (sandbox by default), payment confirmation via PayFast's signed notifications, cancel, and a confirmation email
- A guided tour (opens on first sign-in, reopened by the "?" button) with a step for each part, example sentences, a "Show me" button that highlights the real control, and a feedback box whose notes are saved for the owner
- Per-user rate limits and daily quotas, with a tighter cap for the assistant, to protect the free Groq quota

## Stack
React 19, Vite, TypeScript (strict), Tailwind CSS v4, zod, vite-plugin-pwa, Netlify Functions, Neon Postgres, Better Auth, Groq (Whisper, `openai/gpt-oss` for the assistant, Qwen for drafts, Orpheus for speech), Capacitor (Android).

## Architecture
```
Browser / Android WebView
  Listener (mic, silence detection) -> /api/transcribe -> Groq Whisper
  Assistant loop ----------------> /api/assistant -> Groq LLM + tools -> Neon (drafts, agenda) / iCal feed
  SpeechPlayer <------------------ /api/speak ------> Groq Orpheus (sentence by sentence, prefetched)
  Record screen -----------------> /api/generate ---> Groq LLM (one prompt per channel)
  History / Agenda ---------------> /api/drafts, /api/agenda -> Neon Postgres
Android shell: Capacitor loads the live site; ListeningService (foreground, microphone) keeps it alive with the screen off.
```
Notes: every function requires a session cookie; Groq keys exist only in Netlify function env; replies are chunked to fit the speech model's 200 character limit; each Groq model has its own free token budget, so the assistant and drafts run on different models.

## Run locally
```
npm install
cp .env.example .env.local     # add GROQ_API_KEY, DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
npm run db:migrate
npx netlify-cli@latest dev     # http://localhost:8888
```
Checks: `npm run build`, `npm run lint`.

## Android app
The app is a Capacitor shell around the live site, so web deploys reach it without a new APK.

Requirements: Android Studio (for its JDK 21 and the SDK). Build:
```
npm run build && npx cap sync android
cd android
# debug build
./gradlew assembleDebug
# signed release build (needs ~/.apex-voice-signing/keystore.properties, never committed)
./gradlew assembleRelease
```
Install the release APK by copying it to the phone and opening it (allow "install unknown apps" for your file manager or browser). The first conversation asks for microphone and notification permission. iPhone users use the web app.

## Phase 2
Send from inside Apex (Gmail API or Resend), offline queue, re-generate with a different tone, iOS app.
