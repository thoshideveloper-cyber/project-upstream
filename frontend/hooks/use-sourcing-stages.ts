"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  SourcingStage,
  SourcingStageKind,
  SourcingStageListResponse,
} from "@/types";

/** The firm's funnel stages (SOURCING_LAYER_PLAN §3.1). Self-seeds on first read. */
export function useSourcingStages() {
  return useQuery<SourcingStageListResponse>({
    queryKey: ["sourcing-stages"],
    queryFn: () => api.get<SourcingStageListResponse>("/sourcing-stages"),
    staleTime: 5 * 60_000,
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; kind: SourcingStageKind; sort_order?: number }) =>
      api.post<SourcingStage>("/sourcing-stages", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sourcing-stages"] }),
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<SourcingStage>(`/sourcing-stages/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sourcing-stages"] }),
  });
}

export function useArchiveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ detail: string }>(`/sourcing-stages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sourcing-stages"] }),
  });
}

/** Move a candidate to a new funnel stage; returns transition side-effects. */
export function useChangeCandidateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: number; stageId: number }) =>
      api.patch(`/sourcing-candidates/${id}/stage`, { stage_id: stageId }),
    onSuccess: () => {
      // The kanban board reads from ["sourcing-board", mandateId]; without this it
      // never refetches after a move and the card appears to snap back.
      qc.invalidateQueries({ queryKey: ["sourcing-board"] });
      qc.invalidateQueries({ queryKey: ["sourcing-pool"] });
      qc.invalidateQueries({ queryKey: ["sourcing-candidates"] });
      qc.invalidateQueries({ queryKey: ["funnel-analytics"] });
    },
  });
}
