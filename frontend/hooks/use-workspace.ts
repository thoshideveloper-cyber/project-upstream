"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * The firm's workspace: what it holds, and how to start its book over.
 *
 * `book` is everything an import produced, `database` is the standing company pool that a
 * reset keeps, and `config` is what the firm decided (users, vocabulary, stages). The
 * three are separated because a reset acts on exactly one of them.
 */
export interface Workspace {
  firm: { id: number; name: string };
  database: { companies: number };
  book: Record<string, number>;
  book_total: number;
  config: {
    users: number;
    categories: number;
    stages: number;
    data_sources: number;
    email_templates: number;
  };
}

export interface WorkspaceReset {
  reset: boolean;
  firm: string;
  deleted: Record<string, number>;
  deleted_total: number;
  kept: { database_companies: number; users: number };
}

export function useWorkspace() {
  return useQuery<Workspace>({
    queryKey: ["workspace"],
    queryFn: () => api.get<Workspace>("/workspace"),
    staleTime: 30_000,
  });
}

export function useResetWorkspace() {
  const qc = useQueryClient();
  return useMutation<WorkspaceReset, Error, string>({
    mutationFn: (confirmFirmName) =>
      api.post<WorkspaceReset>("/workspace/reset", { confirm_firm_name: confirmFirmName }),
    // A reset invalidates essentially every read in the app, so drop the whole cache
    // rather than trying to enumerate the keys it touched.
    onSuccess: () => qc.invalidateQueries(),
  });
}
