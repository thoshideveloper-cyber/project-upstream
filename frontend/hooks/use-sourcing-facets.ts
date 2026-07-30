"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RevBand } from "@/hooks/use-candidates";

/** Composition of the firm-wide pool — powers the Discover lens. */
export interface PoolFacets {
  total: number;
  by_category: { id: number; name: string; count: number }[];
  by_hq: { hq: string; count: number }[];
  size_bands: { key: RevBand; label: string; count: number }[];
  /** Profiles with at least one prior placement — warm doors. */
  warm: number;
  /** Profiles scored for the given mandate. */
  scored: number;
}

export function useSourcingFacets(mandateId?: number) {
  return useQuery<PoolFacets>({
    queryKey: ["sourcing-facets", mandateId ?? null],
    queryFn: () =>
      api.get<PoolFacets>(`/sourcing/facets${mandateId ? `?mandate_id=${mandateId}` : ""}`),
    staleTime: 60_000,
  });
}
