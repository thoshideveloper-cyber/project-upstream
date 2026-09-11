"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ActivityListResponse } from "@/types";

const PAGE_SIZE = 50;

export interface ActivityFilters {
  project_id?: number;
  company_id?: number;
  group?: string;
  actor_id?: number;
}

function toQuery(filters: ActivityFilters, page: number): string {
  const p = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    p.set(key, String(value));
  }
  return p.toString();
}

/**
 * The desk feed, paged as you scroll — the same shape as `useDueQueue` in
 * `use-schedule.ts`.
 *
 * Infinite rather than paginated because a feed has no meaningful page 3: you read down
 * until you reach something you already knew, and a pager would make that a decision
 * instead of a scroll.
 */
export function useActivity(filters: ActivityFilters = {}) {
  return useInfiniteQuery<ActivityListResponse>({
    queryKey: ["activity", filters],
    queryFn: ({ pageParam = 1 }) =>
      api.get<ActivityListResponse>(`/activity?${toQuery(filters, pageParam as number)}`),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.page_size < last.total ? last.page + 1 : undefined,
    staleTime: 15_000,
  });
}

/** A single page, for the compact dashboard panel that never scrolls. */
export function useRecentActivity(limit = 8, filters: ActivityFilters = {}) {
  const p = new URLSearchParams({ page: "1", page_size: String(limit) });
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    p.set(key, String(value));
  }
  const qs = p.toString();
  return useQuery<ActivityListResponse>({
    queryKey: ["activity", "recent", qs],
    queryFn: () => api.get<ActivityListResponse>(`/activity?${qs}`),
    staleTime: 15_000,
  });
}

export function useProjectActivity(projectId: number, group?: string) {
  const p = new URLSearchParams({ page_size: String(PAGE_SIZE) });
  if (group) p.set("group", group);
  const qs = p.toString();
  return useQuery<ActivityListResponse>({
    queryKey: ["activity", "project", projectId, group ?? null],
    queryFn: () =>
      api.get<ActivityListResponse>(`/projects/${projectId}/activity?${qs}`),
    enabled: projectId > 0,
    staleTime: 15_000,
  });
}

export function useCompanyActivity(companyId: number) {
  return useQuery<ActivityListResponse>({
    queryKey: ["activity", "company", companyId],
    queryFn: () =>
      api.get<ActivityListResponse>(
        `/companies/${companyId}/activity?page_size=${PAGE_SIZE}`,
      ),
    enabled: companyId > 0,
    staleTime: 15_000,
  });
}
