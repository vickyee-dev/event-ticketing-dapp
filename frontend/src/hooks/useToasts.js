import { useCallback, useMemo, useRef, useState } from "react";

const LIFETIME_MS = { success: 7000, error: 10000, info: 5000 };

/**
 * Tiny toast store. `api.pending()` returns an id that can later be resolved
 * with `api.success(id, ...)` or `api.error(id, ...)`, so one toast follows a
 * transaction from "waiting for wallet" to "confirmed".
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (id, kind) => {
      const ms = LIFETIME_MS[kind];
      if (ms) setTimeout(() => remove(id), ms);
    },
    [remove]
  );

  const add = useCallback(
    (kind, text) => {
      const id = ++counter.current;
      setToasts((list) => [...list, { id, kind, text }]);
      schedule(id, kind);
      return id;
    },
    [schedule]
  );

  const update = useCallback(
    (id, kind, text, txHash) => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, kind, text, txHash } : t)));
      schedule(id, kind);
    },
    [schedule]
  );

  const api = useMemo(
    () => ({
      pending: (text) => add("pending", text),
      progress: (id, text) => update(id, "pending", text),
      info: (text) => add("info", text),
      fail: (text) => add("error", text),
      success: (id, text, txHash) => update(id, "success", text, txHash),
      error: (id, text) => update(id, "error", text),
    }),
    [add, update]
  );

  return { toasts, remove, api };
}
