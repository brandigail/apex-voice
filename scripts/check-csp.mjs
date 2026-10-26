import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// Fails the build if an inline script in the built page is not allowed by the Content-Security-Policy in public/_headers.
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')

const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const missing = inline
  .map((code) => `sha256-${createHash('sha256').update(code).digest('base64')}`)
  .filter((hash) => !headers.includes(`'${hash}'`))

if (missing.length > 0) {
  console.error('An inline script in index.html is not allowed by the Content-Security-Policy in public/_headers.')
  console.error('Add this to script-src, or the page will not run on the live site:')
  for (const hash of missing) console.error(`  '${hash}'`)
  process.exit(1)
}
console.log(`CSP check passed: ${inline.length} inline script(s), all allowed.`)
