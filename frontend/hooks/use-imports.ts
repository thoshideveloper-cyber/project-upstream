"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ImportFieldMeta {
  field: string;
  label: string;
  required: boolean;
}

export interface ImportPreviewResponse {
  batch_id: number;
  file_hash: string;
  headers: string[];
  sample_rows: Record<string, string>[];
  row_count: number;
  suggested_mapping: Record<string, string | null>;
  fields: ImportFieldMeta[];
}

export interface ImportValidateResponse {
  counts: { create: number; update: number; error: number };
  clusters: { key: string; row_indices: number[] }[];
  rows: { index: number; action: string; message: string | null }[];
  total: number;
}

export interface ImportApplyResponse {
  batch_id: number;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  already_applied?: boolean;
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<ImportPreviewResponse>("/imports/csv/preview", form);
    },
  });
}

export function useValidateImport() {
  return useMutation({
    mutationFn: ({ batchId, mapping }: { batchId: number; mapping: Record<string, string | null> }) =>
      api.post<ImportValidateResponse>("/imports/csv/validate", {
        batch_id: batchId,
        mapping,
      }),
  });
}

export function useApplyImport() {
  return useMutation({
    mutationFn: ({ batchId, mapping }: { batchId: number; mapping: Record<string, string | null> }) =>
      api.post<ImportApplyResponse>("/imports/csv/apply", { batch_id: batchId, mapping }),
  });
}
