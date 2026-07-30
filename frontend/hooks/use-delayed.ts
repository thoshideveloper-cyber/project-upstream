"use client";

import { useEffect, useState } from "react";

/**
 * True only once `active` has held for `delay` ms.
 *
 * Skeleton discipline (study §6.2): a query that resolves from cache in 40 ms
 * should never flash a skeleton — the flash reads as jank, not as speed. Gate
 * every loading placeholder on this instead of on `isLoading` directly.
 *
 * The timer is armed in the effect and disarmed (with the flag reset) in its
 * cleanup, and the return is `&&`-ed with `active` so the flag can never survive
 * into the next load and skip its own delay.
 */
export function useDelayed(active: boolean, delay = 300): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delay);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delay]);

  return active && elapsed;
}
