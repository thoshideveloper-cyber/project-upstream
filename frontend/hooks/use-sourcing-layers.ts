"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SourcingLayer } from "@/types";

interface LayerListResponse {
  items: SourcingLayer[];
  total: number;
}

/** Ordered sourcing layers for one engagement (§7.3). */
export function useSourcingLayers(mandateId: number) {
  return useQuery<LayerListResponse>({
    queryKey: ["sourcing-layers", mandateId],
    queryFn: () =>
      api.get<LayerListResponse>(`/sourcing-layers?mandate_id=${mandateId}`),
    staleTime: 60_000,
    enabled: mandateId > 0,
  });
}

export function useCreateSourcingLayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mandate_id: number; name: string; sort_order?: number }) =>
      api.post<SourcingLayer>("/sourcing-layers", data),
    onSuccess: (layer) =>
      qc.invalidateQueries({ queryKey: ["sourcing-layers", layer.mandate_id] }),
  });
}

export function useUpdateSourcingLayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<SourcingLayer>(`/sourcing-layers/${id}`, data),
    onSuccess: (layer) =>
      qc.invalidateQueries({ queryKey: ["sourcing-layers", layer.mandate_id] }),
  });
}

export function useArchiveSourcingLayer(mandateId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ detail: string }>(`/sourcing-layers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sourcing-layers", mandateId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
