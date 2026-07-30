"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Mandate,
  MandateDetail,
  MandateListItem,
  CompanyListResponse,
} from "@/types";

export function useMandates(includeArchived = false) {
  return useQuery<{ items: MandateListItem[]; total: number }>({
    queryKey: ["mandates", { includeArchived }],
    queryFn: () =>
      api.get<{ items: MandateListItem[]; total: number }>(
        `/mandates${includeArchived ? "?include_archived=true" : ""}`
      ),
    staleTime: 30_000,
  });
}

export function useMandate(id: number) {
  return useQuery<MandateDetail>({
    queryKey: ["mandate", id],
    queryFn: () => api.get<MandateDetail>(`/mandates/${id}`),
    staleTime: 30_000,
    enabled: id > 0,
  });
}

export function useMandateCompanies(id: number) {
  return useQuery<{ items: CompanyListResponse["items"]; total: number }>({
    queryKey: ["mandate", id, "companies"],
    queryFn: () =>
      api.get<{ items: CompanyListResponse["items"]; total: number }>(
        `/mandates/${id}/companies`
      ),
    staleTime: 30_000,
    enabled: id > 0,
  });
}

export function useCreateMandate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Mandate>("/mandates", data),
    onSuccess: (mandate) => {
      qc.invalidateQueries({ queryKey: ["mandates"] });
      // Refresh the parent project's engagement list + the project index.
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (mandate?.project_id) {
        qc.invalidateQueries({ queryKey: ["project", mandate.project_id] });
      }
    },
  });
}

export function useUpdateMandate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<Mandate>(`/mandates/${id}`, data),
    onSuccess: (_m, vars) => {
      qc.invalidateQueries({ queryKey: ["mandates"] });
      qc.invalidateQueries({ queryKey: ["mandate", vars.id] });
    },
  });
}

export function useArchiveMandate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      api.post<{ detail: string }>(`/mandates/${id}/${archived ? "unarchive" : "archive"}`),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["mandates"] });
      qc.invalidateQueries({ queryKey: ["mandate", vars.id] });
    },
  });
}

export function useAssignUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mandateId, userId }: { mandateId: number; userId: number }) =>
      api.post<{ detail: string }>(`/mandates/${mandateId}/assignments`, { user_id: userId }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["mandate", vars.mandateId] });
      qc.invalidateQueries({ queryKey: ["mandates"] });
      // Team shows on the deal room masthead + book rail and the project floor rows.
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUnassignUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mandateId, userId }: { mandateId: number; userId: number }) =>
      api.del<{ detail: string }>(`/mandates/${mandateId}/assignments/${userId}`),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["mandate", vars.mandateId] });
      qc.invalidateQueries({ queryKey: ["mandates"] });
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
