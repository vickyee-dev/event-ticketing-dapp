import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { isAddress } from "ethers";
import { CHAIN, CONTRACT_ADDRESS } from "../lib/config";
import { formatDateTime } from "../lib/format";
import { Button, Chip, EmptyState, inputClass } from "./ui";

function ticketStatus(ticket, now) {
  const ev = ticket.event;
  if (!ev) return { label: "Unknown event", tone: "neutral" };
  if (ev.cancelled) return { label: "Cancelled · refund available", tone: "bad" };
  if (ticket.checkedIn) return { label: "Used", tone: "neutral" };
  if (now >= ev.startTime) return { label: "Event started", tone: "warn" };
  return { label: "Valid", tone: "ok" };
}

function TicketCard({ ticket, now, canTransact, onTransfer, onRefund }) {
  const [transferring, setTransferring] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");

  const ev = ticket.event;
  const status = ticketStatus(ticket, now);
  const canTransfer = ev && !ev.cancelled && !ticket.checkedIn;
  const canRefund = ev?.cancelled;
  const validRecipient = isAddress(to.trim());

  // Organizers scan this to look the ticket up; the chain is the source of truth.
  const qrValue = `avaxtix:${CHAIN.id}:${CONTRACT_ADDRESS}:${ticket.id}`;

  const send = async () => {
    setBusy("transfer");
    try {
      const ok = await onTransfer(ticket.id, to.trim());
      if (ok) {
        setTransferring(false);
        setTo("");
      }
    } finally {
      setBusy("");
    }
  };

  const refund = async () => {
    setBusy("refund");
    try {
      await onRefund(ticket);
    } finally {
      setBusy("");
    }
  };

  return (
    <li className="overflow-hidden rounded-2xl bg-ink text-paper">
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={status.tone}>{status.label}</Chip>
            <span className="font-mono text-xs text-paper/70">Ticket #{ticket.id}</span>
          </div>
          <h3 className="mt-4 font-display text-2xl font-bold leading-tight">
            {ev?.name ?? `Event #${ticket.eventId}`}
          </h3>
          {ev && (
            <>
              <p className="mt-1 text-sm text-paper/75">{ev.venue || "Venue to be announced"}</p>
              <p className="mt-3 text-sm font-medium">{formatDateTime(ev.startTime)}</p>
            </>
          )}
        </div>
        <div
          className={`self-start justify-self-start rounded-xl bg-white p-3 sm:justify-self-end ${
            ticket.checkedIn || ev?.cancelled ? "opacity-40" : ""
          }`}
        >
          <QRCodeSVG value={qrValue} size={112} title={`QR code for ticket ${ticket.id}`} />
        </div>
      </div>

      {(canTransfer || canRefund) && (
        <>
          <div className="tear tear-dark" />
          <div className="p-5 sm:px-6">
            {transferring ? (
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Recipient wallet address</span>
                  <input
                    className={`${inputClass} font-mono`}
                    placeholder="0x…"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    autoFocus
                    spellCheck={false}
                  />
                </label>
                {to && !validRecipient && (
                  <p className="text-xs text-[#ffb3b4]">That doesn't look like a valid wallet address.</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={send}
                    busy={busy === "transfer"}
                    disabled={!validRecipient || !canTransact}
                  >
                    Send ticket
                  </Button>
                  <Button variant="onDark" onClick={() => setTransferring(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {canTransfer && (
                  <Button variant="onDark" onClick={() => setTransferring(true)} disabled={!canTransact}>
                    Transfer
                  </Button>
                )}
                {canRefund && (
                  <Button onClick={refund} busy={busy === "refund"} disabled={!canTransact}>
                    Claim refund
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export default function MyTickets({ tickets, now, account, canTransact, onTransfer, onRefund, onConnect, onBrowse }) {
  return (
    <div>
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">My tickets</h1>
      <p className="mt-3 max-w-2xl text-base text-muted">
        Show the code at the door. Once a ticket is checked in it can't be transferred.
      </p>

      <div className="mt-10">
        {!account ? (
          <EmptyState
            title="Connect your wallet"
            action={
              <Button variant="dark" onClick={onConnect}>
                Connect wallet
              </Button>
            }
          >
            Your tickets are tied to your wallet address, so connect it to see what you own.
          </EmptyState>
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            action={<Button variant="dark" onClick={onBrowse}>Browse events</Button>}
          >
            Tickets you buy or receive will appear here.
          </EmptyState>
        ) : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                now={now}
                canTransact={canTransact}
                onTransfer={onTransfer}
                onRefund={onRefund}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
