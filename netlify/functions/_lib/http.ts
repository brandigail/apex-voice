import type { ApiError } from '../../../src/types/api.ts'

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function errorResponse(status: number, error: string): Response {
  return json<ApiError>({ error }, status)
}
