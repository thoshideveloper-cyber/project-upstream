"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PoolSegment, RevBand } from "@/hooks/use-candidates";

/** Composition of the firm-wide pool — powers the Discover lens. */
export interface PoolFacets {
  total: number;
  /** Which side of the market — read off the profile, so it works on an empty book. */
  by_segment: { segment: PoolSegment; count: number }[];
  /** Research bucket; the last entry may be the UNCLASSIFIED_SECTOR remainder. */
  by_sector: { sector: string; label: string; count: number }[];
  by_category: { id: number; name: string; count: number }[];
  by_hq: { hq: string; count: number }[];
  size_bands: { key: RevBand; label: string; count: number }[];
  /**
   * How many companies actually carry each fact. The shipped database has names, cities
   * and domains but no financials, so the lens states the gap rather than rendering
   * empty revenue bands and looking broken.
   */
  coverage: { revenue: number; headcount: number; website: number };
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
