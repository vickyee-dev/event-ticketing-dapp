import { useState } from "react";
import { SYMBOL } from "../lib/config";
import { formatCountdown, formatDateTime, formatPrice } from "../lib/format";
import { Button, Chip } from "./ui";

/** Work out what a visitor can do with this event right now. */
export function eventState(event, now, boughtByMe) {
  const remaining = event.capacity - event.sold;
  if (event.cancelled) return { key: "cancelled", label: "Cancelled", tone: "bad" };
  if (now >= event.startTime) return { key: "started", label: "Started", tone: "neutral" };
  if (remaining <= 0) return { key: "soldout", label: "Sold out", tone: "neutral" };
  if (boughtByMe >= event.maxPerWallet) return { key: "limit", label: "Limit reached", tone: "warn" };
  return { key: "onsale", label: "On sale", tone: "ok" };
}

export default function EventCard({
  event,
  now,
  account,
  wrongNetwork,
  boughtByMe = 0,
  onBuy,
  onConnect,
  onSwitch,
}) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const state = eventState(event, now, boughtByMe);
  const remaining = event.capacity - event.sold;
  const maxQty = Math.max(1, Math.min(remaining, event.maxPerWallet - boughtByMe));
  const quantity = Math.min(qty, maxQty);
  const soldPct = Math.min(100, Math.round((event.sold / event.capacity) * 100));
  const total = event.price * BigInt(quantity);
  const muted = state.key === "cancelled" || state.key === "started";

  const buy = async () => {
    setBusy(true);
    try {
      await onBuy(event, quantity);
      setQty(1);
    } finally {
      setBusy(false);
    }
  };

  let action = null;
  if (state.key === "onsale") {
    if (!account) {
      action = <Button variant="dark" onClick={onConnect}>Connect to buy</Button>;
    } else if (wrongNetwork) {
      action = <Button onClick={onSwitch}>Switch network</Button>;
    } else {
      action = (
        <Button onClick={buy} busy={busy}>
          {event.price === 0n ? `Get ${quantity}` : `Buy ${quantity} · ${formatPrice(total, SYMBOL)}`}
        </Button>
      );
    }
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-line bg-card ${muted ? "opacity-75" : ""}`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Chip tone={state.tone}>{state.label}</Chip>
          {state.key !== "cancelled" && now < event.startTime && (
            <span className="text-xs font-medium text-muted">
              Starts in {formatCountdown(event.startTime - now)}
            </span>
          )}
        </div>

        <h3 className="mt-4 font-display text-2xl font-bold leading-tight">{event.name}</h3>
        <p className="mt-1 text-sm text-muted">{event.venue || "Venue to be announced"}</p>
        <p className="mt-3 text-sm font-medium">{formatDateTime(event.startTime)}</p>

        <div className="mt-5">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="Tickets sold"
            aria-valuemin={0}
            aria-valuemax={event.capacity}
            aria-valuenow={event.sold}
          >
            <div className="h-full rounded-full bg-ink" style={{ width: `${soldPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {event.sold} of {event.capacity} sold
          </p>
        </div>
      </div>

      <div className="tear" />

      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/50 p-5 sm:p-6">
        <div>
          <p className="font-display text-2xl font-bold">{formatPrice(event.price, SYMBOL)}</p>
          <p className="text-xs text-muted">
            {event.maxPerWallet === 1 ? "1 ticket per wallet" : `Up to ${event.maxPerWallet} per wallet`}
            {boughtByMe > 0 && ` · you have ${boughtByMe}`}
          </p>
        </div>

        {action && (
          <div className="flex items-center gap-3">
            {maxQty > 1 && account && !wrongNetwork && (
              <div
                className="flex items-center rounded-lg border border-line bg-white"
                role="group"
                aria-label="Number of tickets"
              >
                <button
                  type="button"
                  className="size-9 text-lg leading-none hover:bg-ink/5 disabled:opacity-40"
                  onClick={() => setQty(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || busy}
                  aria-label="Fewer tickets"
                >
                  −
                </button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  className="size-9 text-lg leading-none hover:bg-ink/5 disabled:opacity-40"
                  onClick={() => setQty(Math.min(maxQty, quantity + 1))}
                  disabled={quantity >= maxQty || busy}
                  aria-label="More tickets"
                >
                  +
                </button>
              </div>
            )}
            {action}
          </div>
        )}
      </div>
    </article>
  );
}
