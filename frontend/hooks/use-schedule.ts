"use client";

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { invalidateOutreachData } from "@/lib/query-invalidation";

export interface SchedulePrimaryContact {
  id: number;
  name: string;
  designation: string | null;
  email: string | null;
}

export interface ScheduleRow {
  company_id: number;
  company_name: string;
  mandate_id: number;
  company_status: string;
  schedule_id: number;
  schedule_status: string;
  initial_date: string | null;
  next_due_date: string | null;
  days_remaining: number | null;
  is_overdue: boolean;
  cadence_interval_days: number;
  regarding: string | null;
  last_event_date: string | null;
  /** Who the outreach goes to — compose prefill + row identity (batched server-side). */
  primary_contact?: SchedulePrimaryContact | null;
}

export interface ScheduleListResponse {
  items: ScheduleRow[];
  total: number;
}

/** Band counts for the whole due set (independent of the current page/filter). */
export interface ScheduleCounts {
  overdue: number;
  due_today: number;
  upcoming: number;
}

export interface ScheduleDayBucket {
  offset: number;
  count: number;
}

export interface DueResponse extends ScheduleListResponse {
  counts?: ScheduleCounts;
  by_day?: ScheduleDayBucket[];
}

export type QueueSort = "urgency" | "name" | "deal";
export type QueueBand = "all" | "overdue" | "today" | "upcoming";

export interface DueQueueParams {
  window?: number;
  mandateId?: number;
  q?: string;
  band?: QueueBand;
  dayOffset?: number | null;
  sort?: QueueSort;
  pageSize?: number;
}

export interface ScheduleStats {
  sent_this_week: number;
  responses_this_week: number;
  response_rate: number;
  overdue_count: number;
}

export function useNeedsInitial() {
  return useQuery<ScheduleListResponse>({
    queryKey: ["schedule", "needs-initial"],
    queryFn: () => api.get<ScheduleListResponse>("/schedule/needs-initial"),
    staleTime: 30_000,
  });
}

export function useDue(window = 7) {
  return useQuery<DueResponse>({
    queryKey: ["schedule", "due", window],
    queryFn: () => api.get<DueResponse>(`/schedule/due?window=${window}`),
    staleTime: 30_000,
  });
}

function queueQueryString(params: DueQueueParams, offset: number, limit: number) {
  const sp = new URLSearchParams();
  sp.set("window", String(params.window ?? 7));
  sp.set("limit", String(limit));
  sp.set("offset", String(offset));
  if (params.sort) sp.set("sort", params.sort);
  if (params.mandateId) sp.set("mandate_id", String(params.mandateId));
  if (params.q) sp.set("q", params.q);
  if (params.band && params.band !== "all") sp.set("band", params.band);
  if (params.dayOffset != null) sp.set("day_offset", String(params.dayOffset));
  return sp.toString();
}

/** Paginated, filterable due-queue for the Schedule cockpit. Reads band counts +
 *  per-day buckets from the first page (the server returns the full-set totals). */
export function useDueQueue(params: DueQueueParams) {
  const pageSize = params.pageSize ?? 40;
  return useInfiniteQuery({
    queryKey: ["schedule", "due-queue", params],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<DueResponse>(`/schedule/due?${queueQueryString(params, pageParam, pageSize)}`),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    staleTime: 15_000,
  });
}

/** Paginated, filterable "needs first outreach" lane. */
export function useNeedsInitialQueue(params: {
  mandateId?: number;
  q?: string;
  pageSize?: number;
}) {
  const pageSize = params.pageSize ?? 40;
  return useInfiniteQuery({
    queryKey: ["schedule", "needs-initial-queue", params],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const sp = new URLSearchParams();
      sp.set("limit", String(pageSize));
      sp.set("offset", String(pageParam));
      if (params.mandateId) sp.set("mandate_id", String(params.mandateId));
      if (params.q) sp.set("q", params.q);
      return api.get<ScheduleListResponse>(`/schedule/needs-initial?${sp.toString()}`);
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    staleTime: 15_000,
  });
}

export function useOverdue() {
  return useQuery<ScheduleListResponse>({
    queryKey: ["schedule", "overdue"],
    queryFn: () => api.get<ScheduleListResponse>("/schedule/overdue"),
    staleTime: 30_000,
  });
}

export function useScheduleStats() {
  return useQuery<ScheduleStats>({
    queryKey: ["schedule", "stats"],
    queryFn: () => api.get<ScheduleStats>("/schedule/stats"),
    staleTime: 30_000,
  });
}

export interface InlineTouchContact {
  contact_person: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
}

export interface LogEventPayload {
  event_type: string;
  occurred_on: string;
  contact_id?: number | null;
  regarding?: string;
  notes?: string;
  mode?: string | null;
  sentiment?: string | null;
  engagement?: string | null;
  new_contact?: InlineTouchContact | null;
}

export function useLogEvent(companyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LogEventPayload) =>
      api.post(`/companies/${companyId}/events`, payload),
    // Optimistic: cancel in-flight queries so stale data doesn't overwrite
    // the optimistic state, then tentatively flip the visible schedule/status.
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["company", companyId] });
      await qc.cancelQueries({ queryKey: ["companies"] });
      const previousCompany = qc.getQueryData(["company", companyId]);

      qc.setQueryData(["company", companyId], (old: Record<string, unknown> | undefined) => {
        if (!old) return old;
        const update: Record<string, unknown> = {};
        if (payload.event_type === "INITIAL_EMAIL") {
          update.schedule_status = "ACTIVE";
          update.initial_date = payload.occurred_on;
        } else if (payload.event_type === "RESPONSE" || payload.event_type === "BOUNCE") {
          update.status = payload.event_type === "RESPONSE" ? "RESPONDED" : "BOUNCED";
          update.schedule_status = "STOPPED";
        }
        return { ...old, ...update };
      });

      return { previousCompany };
    },
    onError: (_err, _payload, context) => {
      if (context?.previousCompany) {
        qc.setQueryData(["company", companyId], context.previousCompany);
      }
    },
    onSettled: () => invalidateOutreachData(qc),
  });
}

/** Log the same touch across many companies at once (bulk clear). */
export function useBulkLogEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      entries: { companyId: number; payload: LogEventPayload }[],
    ) => {
      const results = await Promise.allSettled(
        entries.map((e) => api.post(`/companies/${e.companyId}/events`, e.payload)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { total: entries.length, failed };
    },
    onSettled: () => invalidateOutreachData(qc),
  });
}

/** A cadence cycle (Slice 2): a company that went cold and was restarted has more than one. */
export interface CadenceCycle {
  id: number;
  company_id: number;
  cycle_number: number;
  status: string;
  initial_date: string | null;
  cadence_interval_days: number;
  stopped_reason: string | null;
  is_current?: boolean;
}

/** All cadence cycles for a company — current + historical. Read-only. */
export function useCycles(companyId: number, enabled = true) {
  return useQuery<{ items: CadenceCycle[]; total: number }>({
    queryKey: ["company", companyId, "cycles"],
    queryFn: () => api.get<{ items: CadenceCycle[]; total: number }>(`/companies/${companyId}/cycles`),
    enabled: enabled && Number.isFinite(companyId),
    staleTime: 60_000,
  });
}

export function usePatchSchedule(companyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      data,
    }: {
      action?: "pause" | "resume";
      data?: Record<string, unknown>;
    }) => {
      const qs = action ? `?action=${action}` : "";
      return api.patch(`/companies/${companyId}/schedule${qs}`, data ?? {});
    },
    onSuccess: () => invalidateOutreachData(qc),
  });
}
