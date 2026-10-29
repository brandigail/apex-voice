import { createPortal } from "react-dom";

interface SentPromptProps {
  recipient: string;
  onSent: () => void;
  onNotYet: () => void;
}

/**
 * A pop-up shown when the person comes back from the mail or chat app: was it sent? It is drawn on the page itself, not
 * inside the draft card, because the card clips anything positioned relative to the screen.
 */
export function SentPrompt({ recipient, onSent, onNotYet }: SentPromptProps) {
  return createPortal(
    <div className="fixed inset-0 z-40 bg-black/50">
      <div
        role="alertdialog"
        aria-labelledby="sent-prompt-title"
        className="fixed inset-x-4 bottom-28 mx-auto max-w-md"
      >
        <div className="surface animate-rise bg-slate-900 p-5 text-left shadow-2xl">
          <h2 id="sent-prompt-title" className="text-lg font-bold">
            Did you send it{recipient.trim() ? ` to ${recipient.trim()}` : ""}?
          </h2>
          <p className="muted mt-1 text-sm">
            Apex can&apos;t see inside your other apps, so tell it. Unsent
            messages stay on your To send list.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onSent}
              className="btn flex-1 bg-linear-to-r from-emerald-500 to-teal-500 text-white"
            >
              Yes, it&apos;s sent
            </button>
            <button
              type="button"
              onClick={onNotYet}
              className="btn btn-ghost flex-1"
            >
              Not yet
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
