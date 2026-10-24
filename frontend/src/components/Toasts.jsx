import { CHAIN } from "../lib/config";
import { Spinner } from "./ui";

const TONES = {
  pending: "border-ink/20 bg-card text-ink",
  info: "border-ink/20 bg-card text-ink",
  success: "border-ok bg-card text-ink",
  error: "border-avax bg-card text-ink",
};

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex items-start gap-3 rounded-xl border-l-4 border-y border-r p-3.5 text-sm shadow-lg shadow-ink/10 ${TONES[t.kind]}`}
        >
          {t.kind === "pending" && (
            <span className="mt-0.5">
              <Spinner />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p>{t.text}</p>
            {t.txHash && CHAIN.explorer && (
              <a
                className="mt-1 inline-block text-xs font-semibold underline underline-offset-2"
                href={`${CHAIN.explorer}/tx/${t.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            )}
          </div>
          {t.kind !== "pending" && (
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="-m-1 rounded p-1 text-muted hover:text-ink"
              aria-label="Dismiss notification"
            >
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
