"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SourcingPoolResponse, SourcingStageKind } from "@/types";

export interface BoardCandidate {
  id: number;
  profile_id: number;
  company_name: string;
  hq: string | null;
  revenue_inr_cr: string | null;
  company_id: number | null;
  fit_score: number | null;
  band: string | null;
  insufficient_data: boolean;
  stage_id: number;
}

export interface BoardColumn {
  stage: { id: number; name: string; kind: SourcingStageKind; sort_order: number };
  candidates: BoardCandidate[];
  count: number;
}

export interface BoardResponse {
  columns: BoardColumn[];
}

export type RevBand = "lt100" | "b100_500" | "b500_2000" | "gte2000";

export interface PoolFilters {
  /** Omit to browse the firm's standing company database with no deal selected. */
  mandate_id?: number;
  q?: string;
  hq?: string;
  category_id?: number;
  type?: string;
  rev_min?: string;
  rev_max?: string;
  headcount_min?: number;
  headcount_max?: number;
  has_score?: boolean;
  rev_band?: RevBand;
  warm_only?: boolean;
  /** Profile-level side of the market — narrows the database itself, deal or no deal. */
  segment?: PoolSegment;
  /** Profile-level research bucket; UNCLASSIFIED_SECTOR selects rows carrying none. */
  sector?: string;
  sort?: "name" | "score" | "rev";
  page?: number;
  page_size?: number;
}

export type PoolSegment = "TARGET" | "BUYER" | "INVESTOR";

/** The server's sentinel for "no sector recorded" — a real, filterable state. */
export const UNCLASSIFIED_SECTOR = "__unclassified__";

export function buildPoolQS(filters: PoolFilters): string {
  const p = new URLSearchParams();
  // No mandate → the deal-free database view; the server skips the candidate overlay.
  if (filters.mandate_id) p.set("mandate_id", String(filters.mandate_id));
  if (filters.q) p.set("q", filters.q);
  if (filters.hq) p.set("hq", filters.hq);
  if (filters.category_id) p.set("category_id", String(filters.category_id));
  if (filters.type) p.set("type", filters.type);
  if (filters.rev_min) p.set("rev_min", filters.rev_min);
  if (filters.rev_max) p.set("rev_max", filters.rev_max);
  if (filters.headcount_min != null) p.set("headcount_min", String(filters.headcount_min));
  if (filters.headcount_max != null) p.set("headcount_max", String(filters.headcount_max));
  if (filters.has_score) p.set("has_score", "true");
  if (filters.rev_band) p.set("rev_band", filters.rev_band);
  if (filters.warm_only) p.set("warm_only", "true");
  if (filters.segment) p.set("segment", filters.segment);
  if (filters.sector) p.set("sector", filters.sector);
  if (filters.sort) p.set("sort", filters.sort);
  if (filters.page) p.set("page", String(filters.page));
  if (filters.page_size) p.set("page_size", String(filters.page_size));
  return `?${p.toString()}`;
}

/**
 * Firm-wide pool search, with the candidate overlay for the chosen mandate (§3.3).
 *
 * The pool is the firm's standing company database and exists independently of any
 * deal, so this runs with or without a mandate — without one you get plain inventory
 * (searchable, filterable) and no per-deal stage or AI score.
 */
export function usePool(filters: PoolFilters, enabled = true) {
  return useQuery<SourcingPoolResponse>({
    queryKey: ["sourcing-pool", filters],
    queryFn: () => api.get<SourcingPoolResponse>(`/sourcing/candidates${buildPoolQS(filters)}`),
    enabled,
    staleTime: 20_000,
  });
}

/** Add a pool profile to a mandate funnel at RESEARCH or SHORTLIST. */
export function useAddCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mandate_id: number; profile_id: number; stage_kind: SourcingStageKind }) =>
      api.post("/sourcing/candidates", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sourcing-pool"] });
      qc.invalidateQueries({ queryKey: ["sourcing-candidates"] });
    },
  });
}

/** Kanban board — candidates grouped by stage for one mandate. */
export function useBoard(mandateId: number, enabled = true) {
  return useQuery<BoardResponse>({
    queryKey: ["sourcing-board", mandateId],
    queryFn: () => api.get<BoardResponse>(`/sourcing/board?mandate_id=${mandateId}`),
    enabled: enabled && mandateId > 0,
    staleTime: 15_000,
  });
}

/** Bulk add/advance pool profiles to a funnel stage; returns affected candidate ids. */
export function useBulkAddCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      mandate_id: number;
      profile_ids: number[];
      stage_kind: SourcingStageKind;
    }) => api.post<{ candidate_ids: number[]; count: number }>("/sourcing/candidates/bulk", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sourcing-pool"] });
      qc.invalidateQueries({ queryKey: ["sourcing-board"] });
    },
  });
}
