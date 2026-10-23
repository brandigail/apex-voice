# Apex Voice: Build Plan

- [x] 1. Scaffold Vite React TS, Tailwind v4 plugin, lucide-react, zod, `.env.example`, `.gitignore`, `netlify.toml`
- [x] 2. Provider setup in `main.tsx`; layout, theme, mobile-first shell
- [x] 3. Neon schema (`drafts` table) and a migration script
- [ ] 4. `types/` (Draft, DraftCategory) and a shared zod schema
- [ ] 5. `useAudioRecorder` hook: permission, start/stop, timer, mime detection, 60s cap
- [ ] 6. `netlify/functions/transcribe.ts` (Groq Whisper) with passcode check and size limits
- [ ] 7. `netlify/functions/generate.ts` (Groq LLM, JSON mode, zod validation, one retry on invalid JSON)
- [ ] 8. Record screen UI: record button, timer, processing states, error handling
- [ ] 9. Editable draft card with copy, mailto and sms actions
- [ ] 10. `netlify/functions/db-sync.ts` (list, upsert, delete) and a client sync layer
- [ ] 11. Draft history screen with search and category filter
- [ ] 12. Passcode gate and basic rate limiting
- [ ] 13. PWA: manifest, icons in `/public`, `vite-plugin-pwa` prompt-for-update banner, offline shell
- [ ] 14. Test the full flow on desktop Chrome and a real phone (iOS Safari and Android Chrome)
- [ ] 15. Build, lint and `tsc --noEmit` clean; no console errors
- [ ] 16. README (pitch, architecture diagram, features, recruiter demo bullets)
- [ ] 17. Deploy to Netlify with env vars; test live; push to GitHub; update root `LINKS.md`
