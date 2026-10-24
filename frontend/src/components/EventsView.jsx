import EventCard from "./EventCard";
import { Button, EmptyState } from "./ui";
import { CHAIN } from "../lib/config";

export default function EventsView({
  events,
  now,
  account,
  wrongNetwork,
  boughtByMe,
  status,
  onBuy,
  onConnect,
  onSwitch,
  onCreate,
}) {
  const live = events
    .filter((e) => !e.cancelled && e.startTime > now)
    .sort((a, b) => a.startTime - b.startTime);
  const past = events
    .filter((e) => e.cancelled || e.startTime <= now)
    .sort((a, b) => b.startTime - a.startTime);

  const cardProps = { now, account, wrongNetwork, onBuy, onConnect, onSwitch };

  return (
    <div>
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Upcoming events
        </h1>
        <p className="mt-3 text-base text-muted">
          Buy with {CHAIN.currency.symbol} and the ticket is held by your wallet address. You can
          transfer it to a friend, or get a refund if the organizer cancels.
        </p>
      </div>

      {status === "loading" && events.length === 0 && (
        <p className="mt-10 text-sm text-muted" role="status">
          Loading events from {CHAIN.name}…
        </p>
      )}

      {status === "ready" && events.length === 0 && (
        <div className="mt-10">
          <EmptyState
            title="No events yet"
            action={<Button onClick={onCreate}>Create the first event</Button>}
          >
            Events you create are stored on-chain and show up here for everyone.
          </EmptyState>
        </div>
      )}

      {live.length > 0 && (
        <ul className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {live.map((event) => (
            <li key={event.id}>
              <EventCard event={event} boughtByMe={boughtByMe[event.id] ?? 0} {...cardProps} />
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-14 font-display text-2xl font-bold">Past and cancelled</h2>
          <ul className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {past.map((event) => (
              <li key={event.id}>
                <EventCard event={event} boughtByMe={boughtByMe[event.id] ?? 0} {...cardProps} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
