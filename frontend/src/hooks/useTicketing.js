import { useCallback, useEffect, useMemo, useState } from "react";
import { readContract, toEvent, toTicket } from "../lib/contract";
import { REFRESH_INTERVAL_MS } from "../lib/config";
import { errorMessage, sameAddress } from "../lib/format";

const EMPTY = { events: [], tickets: [], boughtByMe: {}, escrows: {} };

/**
 * Loads everything the UI needs from the chain and keeps it fresh:
 * all events, the connected wallet's tickets, how many tickets that wallet has
 * bought per event, and escrowed proceeds for events it organizes.
 */
export function useTicketing(account) {
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState(readContract ? "loading" : "unconfigured");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!readContract) return;
    try {
      const count = Number(await readContract.eventCount());
      const rawEvents = count > 0 ? await readContract.getEvents(0, count) : [];
      const events = rawEvents.map((r, i) => toEvent(i + 1, r));

      let tickets = [];
      let boughtByMe = {};
      let escrows = {};

      if (account) {
        const mine = events.filter((e) => sameAddress(e.organizer, account));
        const [ticketIds, bought, held] = await Promise.all([
          readContract.ticketsOf(account),
          Promise.all(events.map((e) => readContract.purchased(e.id, account))),
          Promise.all(mine.map((e) => readContract.escrow(e.id))),
        ]);

        boughtByMe = Object.fromEntries(events.map((e, i) => [e.id, Number(bought[i])]));
        escrows = Object.fromEntries(mine.map((e, i) => [e.id, held[i]]));

        const rawTickets = await Promise.all(ticketIds.map((id) => readContract.getTicket(id)));
        const byId = new Map(events.map((e) => [e.id, e]));
        tickets = rawTickets
          .map((r, i) => toTicket(Number(ticketIds[i]), r))
          .map((t) => ({ ...t, event: byId.get(t.eventId) }))
          .sort((a, b) => b.id - a.id);
      }

      setData({ events, tickets, boughtByMe, escrows });
      setError("");
      setStatus("ready");
    } catch (e) {
      console.error("Failed to load from chain", e);
      setError(errorMessage(e));
      setStatus("error");
    }
  }, [account]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return useMemo(() => ({ data, status, error, refresh }), [data, status, error, refresh]);
}
