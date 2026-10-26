/**
 * Server logs are kept by the hosting provider, so they must never contain what a person said or wrote. These helpers
 * describe a failure by its kind only, and are used instead of logging an error or an upstream reply as it is.
 */

const MAX_LENGTH = 160

/** The type of an error and the start of its message, with anything in quotes removed (databases quote the offending value). */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown error'
  const message = err.message.replace(/"[^"]*"/g, '"…"').replace(/'[^']*'/g, "'…'").replace(/\s+/g, ' ')
  return `${err.name}: ${message}`.slice(0, MAX_LENGTH)
}

/** A failed reply from another service as its status and error code only, never its body, which can echo the request. */
export async function describeUpstream(response: Response): Promise<string> {
  let code = ''
  try {
    const body = (await response.json()) as { error?: { code?: unknown; type?: unknown } }
    const found = body.error?.code ?? body.error?.type
    if (typeof found === 'string') code = found.replace(/[^\w.-]/g, '').slice(0, 60)
  } catch {
    // not JSON; the status alone is enough
  }
  return code ? `${response.status} ${code}` : String(response.status)
}
