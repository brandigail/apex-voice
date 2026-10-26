import { useSyncExternalStore } from 'react'

const TICK_MS = 30_000

function subscribe(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, TICK_MS)
  return () => window.clearInterval(timer)
}

/** Rounded down to the tick, so the value stays the same between ticks and React doesn't re-render needlessly. */
function snapshot(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS
}

/** The current time in milliseconds, refreshed every 30 seconds, for things like "overdue" badges. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
