import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * Records the fixed phrases the assistant says (the greeting, the voice sample, the read-back question) once, so they play
 * instantly and use no voice quota. Run: node --env-file=.env.local scripts/make-voice-clips.mjs diana [austin ...]
 * Groq's free voice allows only 100 requests a day and about 15 seconds of speech a minute, so this goes slowly on purpose.
 */
const CLIPS = {
  sample: "Hi, I'm Apex. This is how I'll sound when we talk.",
  greeting: "Hi, I'm listening. What can I do for you?",
  readback: 'Would you like me to read you back your draft?',
}
const voices = process.argv.slice(2)
const key = process.env.GROQ_API_KEY
if (!key || voices.length === 0) {
  console.error('Usage: node --env-file=.env.local scripts/make-voice-clips.mjs <voice> [<voice> ...]')
  process.exit(1)
}

const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000))

async function speak(voice, input) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'canopylabs/orpheus-v1-english', voice, input, response_format: 'wav' }),
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) return Buffer.from(await response.arrayBuffer())
      const wait = Number(response.headers.get('retry-after')) || 20
      console.log(`  attempt ${attempt}: ${response.status}, waiting ${wait}s`)
      await sleep(wait)
    } catch (err) {
      console.log(`  attempt ${attempt}: ${err instanceof Error ? err.name : 'error'}, waiting 10s`)
      await sleep(10)
    }
  }
  throw new Error(`Could not record "${input}" for ${voice}`)
}

for (const voice of voices) {
  const dir = new URL(`../public/voice/${voice}/`, import.meta.url)
  mkdirSync(dir, { recursive: true })
  for (const [name, text] of Object.entries(CLIPS)) {
    const audio = await speak(voice, text)
    writeFileSync(new URL(`${name}.wav`, dir), audio)
    console.log(`${voice}/${name}.wav  ${(audio.length / 1024).toFixed(0)} KB`)
    await sleep(15) // stay under the per-minute speech limit
  }
}
console.log('done')
