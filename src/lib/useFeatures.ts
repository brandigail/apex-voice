import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { Features } from '../types/features'
import { request } from './api'

const featuresSchema = z.object({ subscriptions: z.boolean() })
const NONE: Features = { subscriptions: false }

/** Which preview features the signed-in account may see. Anything unknown or failing stays hidden. */
export function useFeatures(signedIn: boolean): Features {
  const [features, setFeatures] = useState<Features>(NONE)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    request('/api/features', { method: 'GET' })
      .then((body) => {
        const parsed = featuresSchema.safeParse(body)
        if (!cancelled) setFeatures(parsed.success ? parsed.data : NONE)
      })
      .catch(() => !cancelled && setFeatures(NONE))
    return () => {
      cancelled = true
    }
  }, [signedIn])

  return signedIn ? features : NONE
}
