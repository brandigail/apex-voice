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
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <span>A new version of Apex Voice is ready.</span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Later
        </button>
      </span>
    </div>
  )
}
