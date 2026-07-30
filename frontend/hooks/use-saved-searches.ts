"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SavedSearch, SavedSearchScope } from "@/types";

interface SavedSearchListResponse {
  items: SavedSearch[];
  total: number;
}

export function useSavedSearches() {
  return useQuery<SavedSearchListResponse>({
    queryKey: ["saved-searches"],
    queryFn: () => api.get<SavedSearchListResponse>("/saved-searches"),
    staleTime: 60_000,
  });
}

export function useCreateSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      scope: SavedSearchScope;
      criteria: Record<string, unknown>;
    }) => api.post<SavedSearch>("/saved-searches", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ detail: string }>(`/saved-searches/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}
