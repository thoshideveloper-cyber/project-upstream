"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * WB-1 — client-workbook onboarding (inspect → map → preview → apply).
 *
 * Distinct from `use-imports.ts`, which drives the CSV wizard: that one only seeds the
 * sourcing pool (`company_profiles`). This one writes the whole engagement — companies,
 * contacts and a backdated outreach history — so it also needs a project + a per-sheet
 * engagement mapping the partner supplies before anything is read.
 */

export type SheetKind = "MASTER" | "SCHEDULE" | "CONTACTS" | "LONGLIST" | "IGNORE";

export interface SheetShape {
  title: string;
  kind: SheetKind;
  header_row: number | null;
  headers: string[];
  data_row_count: number;
  client_label: string | null;
  exchange_rate: number | null;
  declared_count: number | null;
  unmapped_headers: string[];
  regarding_values: string[];
}

export interface NewMandateSpec {
  name: string;
  type: string;
  exchange_rate?: number | null;
}

export interface SheetPlan {
  sheet: string;
  kind: SheetKind;
  mandate_id?: number | null;
  new_mandate?: NewMandateSpec | null;
  schedule_sheet?: string | null;
  schedule_regarding?: string | null;
  cadence_interval_days?: number;
  /** Echoed back by /inspect so the map step can explain its own suggestion. */
  detected_kind?: SheetKind;
  row_count?: number;
}

export interface WorkbookPlan {
  project_id?: number | null;
  new_project?: { name: string; client_name: string } | null;
  sheets: SheetPlan[];
  reason_mandates?: Record<string, number | null>;
  default_mandate_id?: number | null;
  create_missing_companies?: boolean;
}

export interface InspectResponse {
  batch_id: number;
  filename: string;
  file_hash: string;
  sheets: SheetShape[];
  row_count: number;
  suggested_plan: {
    project: { name: string | null; client_name: string | null };
    sheets: SheetPlan[];
    reasons: string[];
    schedule_sheets: string[];
  };
}

export interface RowFlag {
  code: string;
  label: string;
  detail: string | null;
}

export interface PreviewRow {
  sheet: string;
  row_index: number;
  excel_row: number | null;
  name: string;
  action: "CREATE" | "UPDATE" | "SKIP" | "ERROR";
  message: string | null;
  flags: RowFlag[];
  category_code: string | null;
  layer_name: string | null;
  contacts: string[];
  events: { type: string; on: string; approximate: boolean; notes: string | null }[];
}

export interface PreviewResponse {
  project: { id: number | null; name: string | null; is_new: boolean };
  counts: {
    companies: { create: number; update: number };
    contacts: { create: number; update: number };
    events: { append: number; duplicate: number };
    layers: { create: number };
    errors: number;
  };
  flags: { code: string; label: string; count: number }[];
  sheets: {
    sheet: string;
    kind: SheetKind;
    rows: number;
    mandate_id?: number | null;
    mandate_name?: string;
    mandate_is_new?: boolean;
    schedule_sheet?: string | null;
    schedule_regarding?: string | null;
    schedule_matched?: number;
    unmapped_headers: string[];
  }[];
  rows: PreviewRow[];
  total: number;
}

export interface ApplySummary {
  project_id: number;
  project_name: string;
  mandates: { id: number; name: string; type: string; sheet: string; companies: number }[];
  companies_created: number;
  companies_updated: number;
  contacts_created: number;
  contacts_updated: number;
  events_appended: number;
  events_skipped: number;
  layers_created: number;
  errors: number;
}

export interface ApplyResponse {
  batch_id: number;
  status: string;
  summary: ApplySummary;
  already_applied?: boolean;
}

export interface ImportTargets {
  projects: { id: number; name: string; client_name: string }[];
  mandates: {
    id: number;
    project_id: number | null;
    name: string;
    type: string;
    exchange_rate: number | null;
  }[];
}

export function useImportTargets(enabled = true) {
  return useQuery({
    queryKey: ["workbook-import", "targets"],
    queryFn: () => api.get<ImportTargets>("/imports/workbook/targets"),
    enabled,
  });
}

export function useInspectWorkbook() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<InspectResponse>("/imports/workbook/inspect", form);
    },
  });
}

export function usePreviewWorkbook() {
  return useMutation({
    mutationFn: ({ batchId, plan }: { batchId: number; plan: WorkbookPlan }) =>
      api.post<PreviewResponse>("/imports/workbook/preview", {
        batch_id: batchId,
        plan,
      }),
  });
}

export function useApplyWorkbook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, plan }: { batchId: number; plan: WorkbookPlan }) =>
      api.post<ApplyResponse>("/imports/workbook/apply", { batch_id: batchId, plan }),
    onSuccess: () => {
      // An apply creates projects and engagements, so the wizard's own target list is
      // stale the moment it returns. That matters within a single run: a client's book
      // is several workbooks, and the contact list maps its Reason column onto the
      // engagements the *earlier* files just created. Without this the dropdown offers
      // nothing, every Reason silently falls back to "skip", and the import writes
      // nothing at all.
      qc.invalidateQueries({ queryKey: ["workbook-import", "targets"] });
      // The import also writes across the graph, so anything already on screen is stale.
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["mandates"] });
    },
  });
}
