"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CompanyProfileListResponse } from "@/types";

export type ProfileSort = "name" | "engagements" | "revenue" | "headcount";

export interface ProfileFilters {
  q?: string;
  scope?: "visible" | "firm";
  group_by?: "analyst";
  category_id?: number;
  engagement_type?: string;
  status?: string;
  min_engagements?: number;
  sort?: ProfileSort;
  page?: number;
  page_size?: number;
}

function buildQS(filters: ProfileFilters): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.scope) p.set("scope", filters.scope);
  if (filters.group_by) p.set("group_by", filters.group_by);
  if (filters.category_id) p.set("category_id", String(filters.category_id));
  if (filters.engagement_type) p.set("engagement_type", filters.engagement_type);
  if (filters.status) p.set("status", filters.status);
  if (filters.min_engagements) p.set("min_engagements", String(filters.min_engagements));
  if (filters.sort) p.set("sort", filters.sort);
  if (filters.page) p.set("page", String(filters.page));
  if (filters.page_size) p.set("page_size", String(filters.page_size));
  return p.toString() ? `?${p.toString()}` : "";
}

/** Firm-wide Master List — one row per company with its per-engagement placements. */
export function useCompanyProfiles(filters: ProfileFilters = {}) {
  return useQuery<CompanyProfileListResponse>({
    queryKey: ["company-profiles", filters],
    queryFn: () =>
      api.get<CompanyProfileListResponse>(`/company-profiles${buildQS(filters)}`),
    staleTime: 30_000,
  });
}
