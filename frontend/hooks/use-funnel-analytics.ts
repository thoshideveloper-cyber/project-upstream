"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface FunnelAnalytics {
  by_stage: { stage_name: string; kind: string; count: number }[];
  response_by_stage: {
    stage_name: string;
    kind: string;
    count: number;
    placements: number;
    responded: number;
    response_rate: number;
  }[];
  pool_coverage: { pool_total: number; in_funnel: number; scored: number };
  fit_vs_outcome: {
    high_fit: { n: number; responded: number; response_rate: number };
    low_fit: { n: number; responded: number; response_rate: number };
  };
}

export function useFunnelAnalytics(mandateId?: number) {
  return useQuery<FunnelAnalytics>({
    queryKey: ["funnel-analytics", mandateId ?? null],
    queryFn: () =>
      api.get<FunnelAnalytics>(
        `/sourcing/funnel-analytics${mandateId ? `?mandate_id=${mandateId}` : ""}`,
      ),
    staleTime: 30_000,
  });
}
