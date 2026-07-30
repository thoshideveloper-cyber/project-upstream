"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ScoreResult {
  scored: number;
  cached: number;
  failed: number;
  degraded: boolean;
  provider: string;
}

export interface ScoreStatus {
  OK: number;
  STALE: number;
  FAILED: number;
  unscored: number;
  total: number;
}

/** Batched, cached AI scoring for a mandate (§3.6). */
export function useScoreCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mandate_id: number; profile_ids?: number[] }) =>
      api.post<ScoreResult>("/sourcing/score", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sourcing-pool"] });
      qc.invalidateQueries({ queryKey: ["sourcing-board"] });
      qc.invalidateQueries({ queryKey: ["score-status"] });
      // Scoring changes the lens ("scored" coverage) and funnel counts (candidates
      // are created at Research as a scoring side-effect).
      qc.invalidateQueries({ queryKey: ["sourcing-facets"] });
      qc.invalidateQueries({ queryKey: ["funnel-analytics"] });
    },
  });
}

export function useScoreStatus(mandateId: number, enabled = true) {
  return useQuery<ScoreStatus>({
    queryKey: ["score-status", mandateId],
    queryFn: () => api.get<ScoreStatus>(`/sourcing/score/status?mandate_id=${mandateId}`),
    enabled: enabled && mandateId > 0,
    staleTime: 20_000,
  });
}

export function useScoreFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, vote }: { candidateId: number; vote: "UP" | "DOWN" }) =>
      api.post(`/sourcing/candidates/${candidateId}/score-feedback`, { vote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sourcing-pool"] }),
  });
}
