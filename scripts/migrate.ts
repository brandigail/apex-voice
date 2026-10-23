import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Add it to .env.local (see .env.example).')
  process.exit(1)
}

const sql = neon(url)
const dir = join(import.meta.dirname, '..', 'db')
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

// Neon's HTTP driver runs one statement per call, so split each file on semicolons.
// Migration files must not contain semicolons inside strings or function bodies.
for (const file of files) {
  const statements = readFileSync(join(dir, file), 'utf8')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const statement of statements) {
    await sql.query(statement)
  }
  console.log(`applied ${file} (${statements.length} statements)`)
}
