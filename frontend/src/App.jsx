import { useCallback, useMemo, useState } from "react";
import Header from "./components/Header";
import EventsView from "./components/EventsView";
import MyTickets from "./components/MyTickets";
import Organizer from "./components/Organizer";
import CreateEventDialog from "./components/CreateEventDialog";
import SetupNotice from "./components/SetupNotice";
import Toasts from "./components/Toasts";
import { Button } from "./components/ui";
import { useWallet } from "./hooks/useWallet";
import { useTicketing } from "./hooks/useTicketing";
import { useToasts } from "./hooks/useToasts";
import { useNow } from "./hooks/useNow";
import { getWriteContract } from "./lib/contract";
import { APP_NAME, CHAIN, CONTRACT_ADDRESS, SYMBOL } from "./lib/config";
import { errorMessage, formatPrice, shortAddress } from "./lib/format";

export default function App() {
  const wallet = useWallet();
  const { data, status, error, refresh } = useTicketing(wallet.account);
  const { toasts, remove, api } = useToasts();
  const now = useNow();

  const [tab, setTab] = useState("events");
  const [creating, setCreating] = useState(false);

  const canTransact = Boolean(wallet.account) && !wallet.wrongNetwork && status !== "unconfigured";

  const { connect: connectWallet, switchChain } = wallet;

  const connect = useCallback(async () => {
    try {
      await connectWallet();
    } catch (e) {
      api.fail(errorMessage(e));
    }
  }, [connectWallet, api]);

  const switchNetwork = useCallback(async () => {
    try {
      await switchChain();
    } catch (e) {
      api.fail(errorMessage(e));
    }
  }, [switchChain, api]);

  /**
   * Sends a transaction and follows it with a single toast:
   * waiting for wallet -> waiting for confirmation -> done (or failed).
   * Resolves to true on success so callers can reset their own UI.
   */
  const run = useCallback(
    async (pendingText, successText, send) => {
      const id = api.pending(pendingText);
      try {
        const contract = await getWriteContract();
        const tx = await send(contract);
        api.progress(id, "Waiting for the network to confirm…");
        const receipt = await tx.wait();
        api.success(id, successText, receipt.hash);
        await refresh();
        return true;
      } catch (e) {
        console.error(e);
        api.error(id, errorMessage(e));
        return false;
      }
    },
    [api, refresh]
  );

  const actions = useMemo(
    () => ({
      create: ({ name, venue, startTime, price, capacity, maxPerWallet }) =>
        run("Confirm in your wallet to create the event…", `“${name}” is live.`, (c) =>
          c.createEvent(name, venue, startTime, price, capacity, maxPerWallet)
        ),

      buy: (event, quantity) =>
        run(
          `Confirm in your wallet to buy ${quantity} ticket${quantity > 1 ? "s" : ""}…`,
          `You bought ${quantity} ticket${quantity > 1 ? "s" : ""} to ${event.name}.`,
          (c) => c.buyTickets(event.id, quantity, { value: event.price * BigInt(quantity) })
        ),

      transfer: (ticketId, to) =>
        run(
          "Confirm in your wallet to send the ticket…",
          `Ticket #${ticketId} sent to ${shortAddress(to)}.`,
          (c) => c.transferTicket(ticketId, to)
        ),

      refund: (ticket) =>
        run(
          "Confirm in your wallet to claim your refund…",
          `Refunded ${ticket.event ? formatPrice(ticket.event.price, SYMBOL) : "your ticket"}.`,
          (c) => c.refund(ticket.id)
        ),

      cancel: (event) =>
        run("Confirm in your wallet to cancel the event…", `“${event.name}” was cancelled.`, (c) =>
          c.cancelEvent(event.id)
        ),

      withdraw: (event) =>
        run("Confirm in your wallet to withdraw proceeds…", "Proceeds sent to your wallet.", (c) =>
          c.withdrawProceeds(event.id)
        ),

      setScanner: (event, address, allowed) =>
        run(
          "Confirm in your wallet to update door staff…",
          allowed ? `${shortAddress(address)} can now check in tickets.` : `${shortAddress(address)} was removed.`,
          (c) => c.setScanner(event.id, address, allowed)
        ),

      checkIn: (ticketId) =>
        run("Confirm in your wallet to check in the ticket…", `Ticket #${ticketId} checked in.`, (c) =>
          c.checkIn(ticketId)
        ),
    }),
    [run]
  );

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      <Header
        tab={tab}
        onTab={setTab}
        ticketCount={data.tickets.length}
        wallet={wallet}
        onConnect={connect}
        onSwitch={switchNetwork}
      />

      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        {status === "error" && (
          <div
            role="alert"
            className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-avax/40 bg-avax/10 px-4 py-3 text-sm"
          >
            <p>
              <strong className="font-semibold">Couldn't load from {CHAIN.name}.</strong> {error}
            </p>
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          </div>
        )}

        {status === "unconfigured" ? (
          <>
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Welcome to {APP_NAME}
            </h1>
            <SetupNotice />
          </>
        ) : (
          <>
            {tab === "events" && (
              <EventsView
                events={data.events}
                now={now}
                account={wallet.account}
                wrongNetwork={wallet.wrongNetwork}
                boughtByMe={data.boughtByMe}
                status={status}
                onBuy={actions.buy}
                onConnect={connect}
                onSwitch={switchNetwork}
                onCreate={() => {
                  setTab("organize");
                  setCreating(true);
                }}
              />
            )}

            {tab === "tickets" && (
              <MyTickets
                tickets={data.tickets}
                now={now}
                account={wallet.account}
                canTransact={canTransact}
                onTransfer={actions.transfer}
                onRefund={actions.refund}
                onConnect={connect}
                onBrowse={() => setTab("events")}
              />
            )}

            {tab === "organize" && (
              <Organizer
                events={data.events}
                escrows={data.escrows}
                account={wallet.account}
                now={now}
                canTransact={canTransact}
                onConnect={connect}
                onCreate={() => setCreating(true)}
                onCancel={actions.cancel}
                onWithdraw={actions.withdraw}
                onSetScanner={actions.setScanner}
                onCheckIn={actions.checkIn}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p>
            {APP_NAME} runs on {CHAIN.name}.
            {CHAIN.faucet && (
              <>
                {" "}
                Need test {SYMBOL}?{" "}
                <a className="font-semibold text-ink underline underline-offset-2" href={CHAIN.faucet} target="_blank" rel="noreferrer">
                  Use the faucet
                </a>
                .
              </>
            )}
          </p>
          {CONTRACT_ADDRESS && (
            <p className="font-mono text-xs">
              Contract{" "}
              {CHAIN.explorer ? (
                <a
                  className="underline underline-offset-2"
                  href={`${CHAIN.explorer}/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(CONTRACT_ADDRESS)}
                </a>
              ) : (
                shortAddress(CONTRACT_ADDRESS)
              )}
            </p>
          )}
        </div>
      </footer>

      <CreateEventDialog open={creating} onClose={() => setCreating(false)} onCreate={actions.create} />
      <Toasts toasts={toasts} onDismiss={remove} />
    </div>
  );
}
