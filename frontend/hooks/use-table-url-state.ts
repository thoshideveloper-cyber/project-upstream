"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  decodeState,
  encodeQuery,
  type ParamSpec,
  type StateOf,
} from "@/lib/table-url-state";

/**
 * URL-persisted table state (P2 DataTable pattern).
 *
 * Give it a *module-level* spec (one codec per query param) and it returns the
 * decoded state plus a `patch` setter. Writes go through `history.replaceState`
 * (shareable + reload-stable, no navigation, no scroll jump) and preserve foreign
 * params already in the URL.
 *
 * SSR-safe: the first render uses the spec defaults (matches the server HTML), then
 * a mount effect reads the real `?query` — so a shared/reloaded URL restores state
 * without a hydration mismatch. Pass `{ ready }` to defer that read until a
 * dependency (e.g. the authenticated user) has resolved.
 *
 * IMPORTANT: define `spec` at module scope (a stable reference). It is intentionally
 * not in the effect deps; a per-render spec object would re-hydrate on every render.
 */
export function useTableUrlState<S extends ParamSpec>(
  spec: S,
  { ready = true }: { ready?: boolean } = {},
): [StateOf<S>, (patch: Partial<StateOf<S>>) => void] {
  const [state, setState] = useState<StateOf<S>>(() => decodeState(spec, ""));
  const hydrated = useRef(false);
  /** Kept in sync synchronously so successive patches in one tick still compose. */
  const latest = useRef(state);

  useEffect(() => {
    if (!ready || hydrated.current) return;
    hydrated.current = true;
    const fromUrl = decodeState(spec, window.location.search);
    latest.current = fromUrl;
    setState(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const patch = useCallback(
    (p: Partial<StateOf<S>>) => {
      // The history write happens here, in the event, NOT inside a setState
      // updater: React runs updaters during the render phase, so writing history
      // from one made Next's Router set state mid-render ("Cannot update a
      // component while rendering a different component").
      const next = { ...latest.current, ...p };
      latest.current = next;
      const qs = encodeQuery(spec, next, window.location.search);
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
      setState(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return [state, patch];
}
