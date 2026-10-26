import { useRegisterSW } from 'virtual:pwa-register/react'

/** Asks before swapping in a new version so an update never interrupts a recording. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="surface fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 bg-(--surface-strong)! p-3 text-sm"
    >
      <span>A new version of Apex Voice is ready.</span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="btn btn-primary"
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="btn btn-ghost"
        >
          Later
        </button>
      </span>
    </div>
  )
}
