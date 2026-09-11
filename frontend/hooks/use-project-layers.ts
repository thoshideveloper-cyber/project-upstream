"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { SourcingLayer } from "@/types";

interface LayerListResponse {
  items: SourcingLayer[];
  total: number;
}

/**
 * Band order for every engagement in a project, as `{ mandateId: layerId[] }`.
 *
 * Bands (sourcing layers) are defined per engagement, so a project-wide workspace needs
 * one order per book — and a hook cannot be called in a loop. `useQueries` is the
 * supported way to fan out over a list whose length changes, and it shares the same
 * `["sourcing-layers", mandateId]` cache keys as `useSourcingLayers`, so a project that
 * has already opened one engagement pays for nothing twice.
 *
 * Order matters: a band called "Tier 1" has to sit above "Tier 3" regardless of the
 * alphabet. Without this the workspace would fall back to a label sort, which is
 * defensible but wrong for a firm that named its bands deliberately.
 */
export function useProjectLayerOrder(mandateIds: number[]): Record<number, number[]> {
  const results = useQueries({
    queries: mandateIds.map((id) => ({
      queryKey: ["sourcing-layers", id],
      queryFn: () => api.get<LayerListResponse>(`/sourcing-layers?mandate_id=${id}`),
      staleTime: 60_000,
      enabled: id > 0,
    })),
  });

  // The ids are the dependency, not the result objects — `useQueries` returns a fresh
  // array every render, so depending on it would rebuild the map on every render and
  // re-run the workspace's `buildWorkspace` memo with it.
  const key = mandateIds.join(",");
  const data = results.map((r) => r.data);
  const ready = data.filter(Boolean).length;

  return useMemo(() => {
    const out: Record<number, number[]> = {};
    mandateIds.forEach((id, i) => {
      out[id] = (data[i]?.items ?? []).map((l) => l.id);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
}
