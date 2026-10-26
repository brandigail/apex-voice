import { useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Eye, X } from 'lucide-react'
import { FeedbackForm } from './FeedbackForm'
import { TOUR_STEPS, type TourStep } from './steps'

interface GuidedTourProps {
  open: boolean
  /** Zero-based index of the step on show. */
  step: number
  onStep: (step: number) => void
  /** Closes the tour for good (finished or skipped). */
  onFinish: () => void
  /** Closes the tour, opens the real screen and highlights the control; the tour waits to be resumed. */
  onShow: (step: TourStep, index: number) => void
}

const isIPhone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

/** A step-by-step introduction, one part of the app at a time, with example sentences and a "Show me" button. */
export function GuidedTour({ open, step, onStep, onFinish, onShow }: GuidedTourProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const current = TOUR_STEPS[step]
  const last = step === TOUR_STEPS.length - 1
  const Icon = current.icon

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="tour-title"
      onCancel={(e) => {
        e.preventDefault()
        onFinish()
      }}
      style={{ '--c1': current.from, '--c2': current.to } as CSSProperties}
      className="m-auto w-[min(94vw,32rem)] rounded-3xl border border-(--line) bg-(--surface-strong) p-0 text-(--ink) shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="h-1.5 bg-linear-to-r from-(--c1) to-(--c2)" aria-hidden="true" />
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-(--c1) to-(--c2) text-white shadow-lg">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <button type="button" onClick={onFinish} aria-label="Close the tour" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-violet-500/15">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <p className="muted mt-4 text-xs font-bold tracking-wide uppercase">
            Step {step + 1} of {TOUR_STEPS.length}
          </p>
          <h2 id="tour-title" className="mt-1 text-2xl font-extrabold tracking-tight">
            {current.title}
          </h2>
          <p className="muted mt-2">{current.summary}</p>

          <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-relaxed">
            {current.points.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-linear-to-br from-(--c1) to-(--c2)" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
            {current.id === 'assistant' && isIPhone && (
              <li className="flex gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                On an iPhone: open Apex from the Home Screen icon, and set Settings, Display &amp; Brightness, Auto-Lock to Never while you use the assistant.
              </li>
            )}
          </ul>

          {current.tryIt && (
            <div className="surface mt-4 p-4">
              <p className="text-sm font-semibold">Try saying</p>
              <ul className="muted mt-2 space-y-1.5 text-sm">
                {current.tryIt.map((sentence) => (
                  <li key={sentence}>“{sentence}”</li>
                ))}
              </ul>
            </div>
          )}

          {current.id === 'feedback' && (
            <div className="mt-4">
              <FeedbackForm screen="tour" id="tour-feedback" />
            </div>
          )}

          {current.show && (
            <button type="button" onClick={() => onShow(current, step)} className="btn btn-ghost mt-5 w-full">
              <Eye className="size-4" aria-hidden="true" />
              {current.show.label}
            </button>
          )}
        </div>

        <div className="border-t border-(--line) p-4">
          <div className="mb-3 flex justify-center gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <span key={s.id} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-violet-500' : 'w-1.5 bg-(--line)'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => onStep(step - 1)} className="btn btn-ghost">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
            ) : (
              <button type="button" onClick={onFinish} className="btn btn-ghost">
                Skip tour
              </button>
            )}
            <button type="button" onClick={last ? onFinish : () => onStep(step + 1)} className="btn btn-primary ml-auto">
              {last ? "Let's go" : 'Next'}
              {!last && <ArrowRight className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
