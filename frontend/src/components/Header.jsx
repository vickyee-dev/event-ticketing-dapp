import { APP_NAME, CHAIN } from "../lib/config";
import { shortAddress } from "../lib/format";
import { Button } from "./ui";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0d1b2a" />
      <path
        d="M6 11a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V21a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z"
        fill="#e84142"
      />
      <path d="M20 10v12" stroke="#0d1b2a" strokeWidth="1.4" strokeDasharray="1.8 2" />
    </svg>
  );
}

const TABS = [
  { id: "events", label: "Events" },
  { id: "tickets", label: "My tickets" },
  { id: "organize", label: "Organize" },
];

export default function Header({ tab, onTab, ticketCount, wallet, onConnect, onSwitch }) {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
          <Mark />
          <span className="font-display text-xl font-extrabold tracking-tight">{APP_NAME}</span>
        </a>

        <nav aria-label="Sections" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-ink text-paper" : "text-ink hover:bg-ink/10"
              }`}
            >
              {t.label}
              {t.id === "tickets" && ticketCount > 0 && (
                <span className="ml-2 rounded-full bg-avax-bright px-1.5 py-0.5 text-xs text-white">
                  {ticketCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {wallet.wrongNetwork ? (
            <Button onClick={onSwitch}>Switch to {CHAIN.name}</Button>
          ) : (
            <span className="hidden items-center gap-2 text-sm text-muted sm:flex">
              <span
                className={`size-2 rounded-full ${wallet.account ? "bg-ok" : "bg-line"}`}
                aria-hidden="true"
              />
              {CHAIN.name}
            </span>
          )}

          {wallet.account ? (
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm">
                {shortAddress(wallet.account)}
              </span>
              <Button variant="ghost" onClick={wallet.disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button variant="dark" onClick={onConnect} busy={wallet.connecting}>
              Connect wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
