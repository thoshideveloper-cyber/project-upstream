"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { invalidateOutreachData } from "@/lib/query-invalidation";
import type { CompanyListResponse, CompanyDetail, Company, DuplicateWarning } from "@/types";

export interface CreateCompanyResponse extends Company {
  duplicate_warnings?: DuplicateWarning[];
}

export interface CompanyFilters {
  q?: string;
  status?: string;
  type?: string;
  bucket?: string;
  category?: string;
  category_id?: number;
  sourcing_layer_id?: number;
  unsorted?: boolean;
  mandate_id?: number;
  /** Every engagement in one project — the deal room's whole book in one read. */
  project_id?: number;
  source?: string;
  sort?: string;
  page?: number;
  page_size?: number;
  include_archived?: boolean;
}

function buildQS(filters: CompanyFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.status) p.set("status", filters.status);
  if (filters.type) p.set("type", filters.type);
  if (filters.bucket) p.set("bucket", filters.bucket);
  if (filters.category) p.set("category", filters.category);
  if (filters.category_id) p.set("category_id", String(filters.category_id));
  if (filters.sourcing_layer_id) p.set("sourcing_layer_id", String(filters.sourcing_layer_id));
  if (filters.unsorted) p.set("unsorted", "true");
  if (filters.mandate_id) p.set("mandate_id", String(filters.mandate_id));
  if (filters.project_id) p.set("project_id", String(filters.project_id));
  if (filters.source) p.set("source", filters.source);
  if (filters.sort) p.set("sort", filters.sort);
  if (filters.page) p.set("page", String(filters.page));
  if (filters.page_size) p.set("page_size", String(filters.page_size));
  if (filters.include_archived) p.set("include_archived", "true");
  return p.toString() ? `?${p.toString()}` : "";
}

export function useCompanies(filters: CompanyFilters = {}, opts: { enabled?: boolean } = {}) {
  return useQuery<CompanyListResponse>({
    queryKey: ["companies", filters],
    queryFn: () => api.get<CompanyListResponse>(`/companies${buildQS(filters)}`),
    staleTime: 30_000,
    enabled: opts.enabled ?? true,
  });
}

export function useCompany(id: number) {
  return useQuery<CompanyDetail>({
    queryKey: ["company", id],
    queryFn: () => api.get<CompanyDetail>(`/companies/${id}`),
    staleTime: 30_000,
  });
}

/** Advisory warm/duplicate check while typing a new company name (§8-E). */
export function useCheckDuplicate(
  name: string,
  website: string,
  mandateId: number,
) {
  return useQuery<{ warnings: DuplicateWarning[] }>({
    queryKey: ["check-duplicate", name, website, mandateId],
    queryFn: () => {
      const p = new URLSearchParams({ name, mandate_id: String(mandateId) });
      if (website) p.set("website", website);
      return api.get<{ warnings: DuplicateWarning[] }>(`/companies/check-duplicate?${p.toString()}`);
    },
    enabled: name.trim().length > 2 && mandateId > 0,
    staleTime: 10_000,
  });
}

export function useArchiveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ detail: string }>(`/companies/${id}`),
    onSuccess: () => invalidateOutreachData(qc),
  });
}

export function useUnarchiveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<CompanyDetail>(`/companies/${id}/unarchive`),
    onSuccess: (company) => {
      qc.setQueryData(["company", company.id], company);
      invalidateOutreachData(qc);
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<CreateCompanyResponse>("/companies", data),
    onSuccess: () => invalidateOutreachData(qc),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<CompanyDetail>(`/companies/${id}`, data),
    // Optimistic: immediately update the company detail cache so the detail page
    // feels instant; cancel in-flight fetches to prevent stale overwrite.
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["company", id] });
      const previous = qc.getQueryData(["company", id]);
      qc.setQueryData(["company", id], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, ...data } : old,
      );
      return { previous, id };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["company", context.id], context.previous);
      }
    },
    onSuccess: (company) => {
      qc.setQueryData(["company", company.id], company);
      invalidateOutreachData(qc);
    },
  });
}
