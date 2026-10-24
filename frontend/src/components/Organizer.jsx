import { useState } from "react";
import { isAddress } from "ethers";
import { readContract, toTicket } from "../lib/contract";
import { SYMBOL } from "../lib/config";
import { errorMessage, formatAmount, formatDateTime, sameAddress, shortAddress } from "../lib/format";
import { Button, Chip, EmptyState, Field, Panel, inputClass } from "./ui";

/** Look a ticket up on-chain and check it in. Works for organizers and approved scanners. */
function CheckInPanel({ events, canTransact, onCheckIn }) {
  const [id, setId] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const lookup = async (e) => {
    e.preventDefault();
    setResult(null);
    setMessage("");
    const ticketId = Number(id);
    if (!Number.isInteger(ticketId) || ticketId < 1) {
      setMessage("Enter a ticket number, for example 12.");
      return;
    }
    setBusy("lookup");
    try {
      const raw = await readContract.getTicket(ticketId);
      const ticket = toTicket(ticketId, raw);
      setResult({ ticket, event: events.find((ev) => ev.id === ticket.eventId) });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  };

  const checkIn = async () => {
    setBusy("checkin");
    try {
      const ok = await onCheckIn(result.ticket.id);
      if (ok) setResult({ ...result, ticket: { ...result.ticket, checkedIn: true } });
    } finally {
      setBusy("");
    }
  };

  const { ticket, event } = result ?? {};

  return (
    <Panel>
      <h2 className="font-display text-xl font-bold">Check in a ticket</h2>
      <p className="mt-1 text-sm text-muted">
        Enter the ticket number from the attendee's QR code. Only the organizer and approved scanners can
        check tickets in.
      </p>

      <form onSubmit={lookup} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label="Ticket number">
            <input
              className={inputClass}
              inputMode="numeric"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="12"
            />
          </Field>
        </div>
        <Button type="submit" variant="dark" busy={busy === "lookup"} disabled={!id}>
          Look up
        </Button>
      </form>

      {message && (
        <p role="alert" className="mt-3 text-sm text-avax">
          {message}
        </p>
      )}

      {result && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-4">
          <div className="min-w-0">
            <p className="font-semibold">
              Ticket #{ticket.id} · {event?.name ?? `Event #${ticket.eventId}`}
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted">Held by {shortAddress(ticket.owner)}</p>
          </div>
          <div className="flex items-center gap-3">
            {ticket.checkedIn ? (
              <Chip tone="neutral">Already used</Chip>
            ) : event?.cancelled ? (
              <Chip tone="bad">Event cancelled</Chip>
            ) : (
              <>
                <Chip tone="ok">Valid</Chip>
                <Button onClick={checkIn} busy={busy === "checkin"} disabled={!canTransact}>
                  Check in
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ScannerControls({ event, canTransact, onSetScanner }) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState("");
  const valid = isAddress(address.trim());

  const update = async (allowed) => {
    setBusy(allowed ? "add" : "remove");
    try {
      const ok = await onSetScanner(event, address.trim(), allowed);
      if (ok) setAddress("");
    } finally {
      setBusy("");
    }
  };

  return (
    <details className="mt-4 rounded-xl border border-line bg-white/60 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">Door staff</summary>
      <div className="mt-3 grid gap-3">
        <p className="text-sm text-muted">
          Approved wallets can check tickets in for this event without being the organizer.
        </p>
        <input
          className={`${inputClass} font-mono`}
          placeholder="0x… wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          spellCheck={false}
          aria-label="Door staff wallet address"
        />
        <div className="flex flex-wrap gap-3">
          <Button
            variant="dark"
            onClick={() => update(true)}
            busy={busy === "add"}
            disabled={!valid || !canTransact}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            onClick={() => update(false)}
            busy={busy === "remove"}
            disabled={!valid || !canTransact}
          >
            Remove
          </Button>
        </div>
      </div>
    </details>
  );
}

function OrganizerEvent({ event, escrow = 0n, now, canTransact, onCancel, onWithdraw, onSetScanner }) {
  const [busy, setBusy] = useState("");
  const started = now >= event.startTime;

  const run = (key, fn) => async () => {
    setBusy(key);
    try {
      await fn(event);
    } finally {
      setBusy("");
    }
  };

  const tone = event.cancelled ? "bad" : started ? "neutral" : "ok";
  const label = event.cancelled ? "Cancelled" : started ? "Started" : "On sale";

  return (
    <li>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Chip tone={tone}>{label}</Chip>
              <span className="text-xs text-muted">Event #{event.id}</span>
            </div>
            <h3 className="mt-3 font-display text-2xl font-bold leading-tight">{event.name}</h3>
            <p className="mt-1 text-sm text-muted">
              {event.venue || "Venue to be announced"} · {formatDateTime(event.startTime)}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <dt className="text-muted">Sold</dt>
            <dd className="text-right font-semibold tabular-nums">
              {event.sold} / {event.capacity}
            </dd>
            <dt className="text-muted">Held in escrow</dt>
            <dd className="text-right font-semibold tabular-nums">{formatAmount(escrow, SYMBOL)}</dd>
          </dl>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            onClick={run("withdraw", onWithdraw)}
            busy={busy === "withdraw"}
            disabled={!canTransact || event.cancelled || !started || escrow === 0n}
          >
            Withdraw proceeds
          </Button>
          <Button
            variant="secondary"
            onClick={run("cancel", onCancel)}
            busy={busy === "cancel"}
            disabled={!canTransact || event.cancelled || started}
          >
            Cancel event
          </Button>
          {!event.cancelled && !started && (
            <span className="text-xs text-muted">Proceeds unlock when the event starts.</span>
          )}
          {event.cancelled && (
            <span className="text-xs text-muted">Ticket holders can claim refunds from escrow.</span>
          )}
        </div>

        {!event.cancelled && (
          <ScannerControls event={event} canTransact={canTransact} onSetScanner={onSetScanner} />
        )}
      </Panel>
    </li>
  );
}

export default function Organizer({
  events,
  escrows,
  account,
  now,
  canTransact,
  onConnect,
  onCreate,
  onCancel,
  onWithdraw,
  onSetScanner,
  onCheckIn,
}) {
  const mine = events.filter((e) => sameAddress(e.organizer, account)).sort((a, b) => b.id - a.id);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Organize</h1>
          <p className="mt-3 text-base text-muted">
            Ticket sales are held in escrow until your event starts, so buyers are protected if you cancel.
          </p>
        </div>
        {account && (
          <Button onClick={onCreate} disabled={!canTransact}>
            Create event
          </Button>
        )}
      </div>

      {!account ? (
        <div className="mt-10">
          <EmptyState
            title="Connect your wallet"
            action={
              <Button variant="dark" onClick={onConnect}>
                Connect wallet
              </Button>
            }
          >
            Events are owned by the wallet that creates them.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-10 grid gap-8">
          <CheckInPanel events={events} canTransact={canTransact} onCheckIn={onCheckIn} />

          <div>
            <h2 className="font-display text-2xl font-bold">Your events</h2>
            {mine.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="You haven't created an event yet"
                  action={
                    <Button onClick={onCreate} disabled={!canTransact}>
                      Create event
                    </Button>
                  }
                >
                  Set a price, capacity and start time. It goes live as soon as the transaction confirms.
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-5 grid gap-5">
                {mine.map((event) => (
                  <OrganizerEvent
                    key={event.id}
                    event={event}
                    escrow={escrows[event.id]}
                    now={now}
                    canTransact={canTransact}
                    onCancel={onCancel}
                    onWithdraw={onWithdraw}
                    onSetScanner={onSetScanner}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
