"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OverviewStats {
  total: number;
  by_status: Record<string, number>;
  responded_pct: number;
  responded: number;
  bounced: number;
  emails_sent: number;
  due_this_week: number;
  overdue: number;
  needs_initial: number;
  active_mandates: number;
}

export interface CategoryRow {
  category: string;
  category_id: number | null;
  total: number;
  responded: number;
  response_rate: number;
}

export interface LayerRow {
  layer: string;
  sourcing_layer_id: number | null;
  total: number;
  responded: number;
  response_rate: number;
}

export interface AnalystRow {
  user_id: number;
  full_name: string;
  role: string;
  total_events: number;
  initial_emails: number;
  emails_sent: number;
  responses: number;
  conversion_rate: number;
}

export interface SourceRow {
  source: string | null;
  source_quality: string | null;
  total: number;
  responded: number;
  response_rate: number;
}

export interface EngagementRow {
  mandate_id: number;
  name: string;
  type: string;
  total_companies: number;
  emails_sent: number;
  responded: number;
  bounced: number;
  response_rate: number;
}

export interface BenchmarkData {
  mandate_response_rate: number;
  mandate_avg_touches_to_response: number | null;
  mandate_avg_days_to_response: number | null;
  this_company_touches: number;
  this_company_days_to_response: number | null;
}

export interface TimeseriesPoint {
  week_start: string;
  label: string;
  sent: number;
  initial: number;
  responses: number;
}

export interface LatencyBucket {
  label: string;
  count: number;
}

export interface LatencyDimension {
  median: number | null;
  with_data: number;
  buckets: LatencyBucket[];
}

export interface ReplyTiming {
  responded_total: number;
  days: LatencyDimension;
  touches: LatencyDimension;
}

export function useAnalyticsOverview() {
  return useQuery<OverviewStats>({
    queryKey: ["analytics", "overview"],
    queryFn: () => api.get<OverviewStats>("/analytics/overview"),
    staleTime: 60_000,
  });
}

export function useTimeseries(weeks = 12) {
  return useQuery<{ items: TimeseriesPoint[] }>({
    queryKey: ["analytics", "timeseries", weeks],
    queryFn: () => api.get<{ items: TimeseriesPoint[] }>(`/analytics/timeseries?weeks=${weeks}`),
    staleTime: 60_000,
  });
}

export function useResponseByCategory() {
  return useQuery<{ items: CategoryRow[] }>({
    queryKey: ["analytics", "response-by-category"],
    queryFn: () => api.get<{ items: CategoryRow[] }>("/analytics/response-by-category"),
    staleTime: 60_000,
  });
}

export function useResponseByLayer() {
  return useQuery<{ items: LayerRow[] }>({
    queryKey: ["analytics", "response-by-layer"],
    queryFn: () => api.get<{ items: LayerRow[] }>("/analytics/response-by-layer"),
    staleTime: 60_000,
  });
}

export function useByAnalyst({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<{ items: AnalystRow[] }>({
    queryKey: ["analytics", "by-analyst"],
    queryFn: () => api.get<{ items: AnalystRow[] }>("/analytics/by-analyst"),
    staleTime: 60_000,
    enabled,
  });
}

export function useByEngagement() {
  return useQuery<{ items: EngagementRow[] }>({
    queryKey: ["analytics", "by-engagement"],
    queryFn: () => api.get<{ items: EngagementRow[] }>("/analytics/by-engagement"),
    staleTime: 60_000,
  });
}

export function useSources() {
  return useQuery<{ items: SourceRow[] }>({
    queryKey: ["analytics", "sources"],
    queryFn: () => api.get<{ items: SourceRow[] }>("/analytics/sources"),
    staleTime: 60_000,
  });
}

export function useReplyTiming() {
  return useQuery<ReplyTiming>({
    queryKey: ["analytics", "response-latency"],
    queryFn: () => api.get<ReplyTiming>("/analytics/response-latency"),
    staleTime: 60_000,
  });
}

export function useBenchmark(companyId: number) {
  return useQuery<BenchmarkData>({
    queryKey: ["benchmark", companyId],
    queryFn: () => api.get<BenchmarkData>(`/companies/${companyId}/benchmark`),
    staleTime: 60_000,
    enabled: companyId > 0,
  });
}

import type { ProjectAnalyticsResponse } from "@/types";

export function useProjectAnalytics({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<ProjectAnalyticsResponse>({
    queryKey: ["analytics", "projects"],
    queryFn: () => api.get<ProjectAnalyticsResponse>("/analytics/projects"),
    staleTime: 60_000,
    enabled,
  });
}
