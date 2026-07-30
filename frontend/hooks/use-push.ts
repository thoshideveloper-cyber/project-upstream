"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { invalidateOutreachData } from "@/lib/query-invalidation";
import type { WarmHistory } from "@/types";

export interface PushEngagementChoice {
  mandate_id: number;
  name: string;
  client_name: string;
  type: string;
}

export interface PushResponse {
  pushed?: boolean;
  already_present?: boolean;
  company_id?: number;
  mandate_id?: number;
  prompt_log_initial?: boolean;
  warm_history?: WarmHistory[];
  needs_choice?: PushEngagementChoice[];
  can_create?: boolean;
  existing_sides?: string[];
  project_id?: number;
  side?: string;
}

export interface PushRequest {
  profile_id: number;
  project_id: number;
  side: string;
  mandate_id?: number;
}

export function usePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PushRequest) => api.post<PushResponse>("/sourcing/push", data),
    onSuccess: (res) => {
      if (res.pushed || res.already_present) {
        qc.invalidateQueries({ queryKey: ["sourcing-pool"] });
        qc.invalidateQueries({ queryKey: ["my-book"] });
        invalidateOutreachData(qc);
      }
    },
  });
}

export function useCreateEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { project_id: number; side: string; name?: string }) =>
      api.post<{ mandate_id: number; name: string; type: string }>(
        "/sourcing/engagements",
        data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandates"] }),
  });
}

export function useLogInitialEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, date }: { companyId: number; date: string }) =>
      api.post(`/companies/${companyId}/events`, {
        event_type: "INITIAL_EMAIL",
        occurred_on: date,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sourcing-pool"] });
      invalidateOutreachData(qc);
    },
  });
}
