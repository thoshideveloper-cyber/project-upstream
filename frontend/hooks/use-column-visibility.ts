"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * localStorage-backed column visibility for the P2 DataTable pattern.
 *
 * A table passes a stable `storageKey` and its list of toggleable column keys plus
 * which are hidden by default. Hydration-safe: first render uses the defaults (SSR
 * parity), then a mount effect restores the saved set. Only keys the table still
 * declares are honoured, so removing a column later can't resurrect a stale key.
 */
export function useColumnVisibility(
  storageKey: string,
  allKeys: readonly string[],
  defaultHidden: readonly string[] = [],
): {
  isVisible: (key: string) => boolean;
  toggle: (key: string) => void;
  hiddenCount: number;
} {
  const initial = () => new Set(allKeys.filter((k) => !defaultHidden.includes(k)));
  const [visible, setVisible] = useState<Set<string>>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!Array.isArray(saved)) return;
      // Intersect saved with the currently declared columns.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(new Set(allKeys.filter((k) => (saved as string[]).includes(k))));
    } catch {
      /* keep defaults */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const toggle = useCallback(
    (key: string) => {
      setVisible((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          /* ignore quota / private-mode errors */
        }
        return next;
      });
    },
    [storageKey],
  );

  return {
    isVisible: (key: string) => visible.has(key),
    toggle,
    hiddenCount: allKeys.length - visible.size,
  };
}
