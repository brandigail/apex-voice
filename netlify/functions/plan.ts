import { neon } from '@neondatabase/serverless'
import { z } from 'zod'
import { CURRENCIES, PLANS, type PlanChoice } from '../../src/types/plans.ts'
import { featuresFor } from './_lib/features.ts'
import { errorResponse, json } from './_lib/http.ts'
import { requireUser } from './_lib/session.ts'

const choiceSchema = z.object({
  plan: z.enum(PLANS.map((plan) => plan.id) as [string, ...string[]]),
  currency: z.enum(CURRENCIES.map((currency) => currency.code) as [string, ...string[]]),
})

/** The plan and currency the user picked. Billing isn't switched on yet, so this only records the choice. */
export default async function handler(req: Request): Promise<Response> {
  const session = await requireUser(req)
  if (!session.ok) return session.response
  if (!featuresFor(session.user.email).subscriptions) return errorResponse(404, 'Not found.')
  const sql = neon(process.env.DATABASE_URL ?? '')

  try {
    if (req.method === 'GET') {
      const [row] = (await sql.query('SELECT plan, currency FROM plan_interest WHERE user_id = $1', [session.user.id])) as PlanChoice[]
      return json<{ choice: PlanChoice | null }>({ choice: row ?? null })
    }
    if (req.method === 'PUT') {
      const parsed = choiceSchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return errorResponse(400, 'Pick a plan and a currency from the list.')
      await sql.query(
        `INSERT INTO plan_interest (user_id, plan, currency) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, currency = EXCLUDED.currency, updated_at = now()`,
        [session.user.id, parsed.data.plan, parsed.data.currency],
      )
      return json<{ choice: PlanChoice }>({ choice: parsed.data as PlanChoice })
    }
    return errorResponse(405, 'Method not allowed.')
  } catch (err) {
    console.error('Plan request failed:', err)
    return errorResponse(500, 'Could not save your plan. Please try again.')
  }
}
