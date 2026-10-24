import { useEffect, useRef, useState } from "react";
import { parseEther } from "ethers";
import { SYMBOL } from "../lib/config";
import { toLocalInputValue } from "../lib/format";
import { Button, Field, inputClass } from "./ui";

const defaultStart = () => {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInputValue(d);
};

export default function CreateEventDialog({ open, onClose, onCreate }) {
  const dialogRef = useRef(null);
  const [form, setForm] = useState(() => ({
    name: "",
    venue: "",
    start: defaultStart(),
    price: "0.1",
    capacity: "100",
    limit: "4",
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    const venue = form.venue.trim();
    const capacity = Number(form.capacity);
    const limit = Number(form.limit);
    const startTime = Math.floor(new Date(form.start).getTime() / 1000);

    let price;
    try {
      price = parseEther(form.price || "0");
    } catch {
      return setError(`Enter the price as a number, for example 0.1.`);
    }

    if (!name) return setError("Give the event a name.");
    if (new TextEncoder().encode(name).length > 100) return setError("The name is too long (100 characters max).");
    if (new TextEncoder().encode(venue).length > 100) return setError("The venue is too long (100 characters max).");
    if (!Number.isFinite(startTime) || startTime <= Date.now() / 1000 + 60) {
      return setError("Pick a start time in the future.");
    }
    if (!Number.isInteger(capacity) || capacity < 1) return setError("Capacity must be at least 1.");
    if (!Number.isInteger(limit) || limit < 1 || limit > capacity) {
      return setError("The per-wallet limit must be between 1 and the capacity.");
    }

    setBusy(true);
    try {
      const ok = await onCreate({ name, venue, startTime, price, capacity, maxPerWallet: limit });
      if (ok) {
        setForm({ name: "", venue: "", start: defaultStart(), price: "0.1", capacity: "100", limit: "4" });
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink"
      aria-labelledby="create-event-title"
    >
      <form onSubmit={submit} className="grid gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="create-event-title" className="font-display text-2xl font-bold">
              Create an event
            </h2>
            <p className="mt-1 text-sm text-muted">
              Details are stored on-chain and can't be edited later. You can cancel until the start time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded p-1 text-muted hover:text-ink"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="size-5" aria-hidden="true">
              <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <Field label="Event name">
          <input className={inputClass} value={form.name} onChange={set("name")} maxLength={100} autoFocus required />
        </Field>
        <Field label="Venue">
          <input className={inputClass} value={form.venue} onChange={set("venue")} maxLength={100} />
        </Field>
        <Field label="Starts" hint="Ticket sales close at this time. Your local timezone.">
          <input type="datetime-local" className={inputClass} value={form.start} onChange={set("start")} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Price (${SYMBOL})`} hint="0 for a free event">
            <input className={inputClass} inputMode="decimal" value={form.price} onChange={set("price")} />
          </Field>
          <Field label="Capacity">
            <input type="number" min="1" className={inputClass} value={form.capacity} onChange={set("capacity")} />
          </Field>
          <Field label="Max per wallet">
            <input type="number" min="1" className={inputClass} value={form.limit} onChange={set("limit")} />
          </Field>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-avax/40 bg-avax/10 px-3 py-2 text-sm text-avax">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Create event
          </Button>
        </div>
      </form>
    </dialog>
  );
}
