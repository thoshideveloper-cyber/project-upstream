"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CompanyCategoryVocab } from "@/types";

interface CategoryListResponse {
  items: CompanyCategoryVocab[];
  total: number;
}

/** The firm's counterparty-category vocabulary (§7.2). Self-seeds on first read. */
export function useCategories() {
  return useQuery<CategoryListResponse>({
    queryKey: ["company-categories"],
    queryFn: () => api.get<CategoryListResponse>("/company-categories"),
    staleTime: 5 * 60_000, // small, per-firm list — cache aggressively
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; sort_order?: number }) =>
      api.post<CompanyCategoryVocab>("/company-categories", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<CompanyCategoryVocab>(`/company-categories/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-categories"] }),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ detail: string }>(`/company-categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-categories"] }),
  });
}
