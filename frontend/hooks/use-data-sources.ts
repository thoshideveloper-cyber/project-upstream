"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DataSourceConfig } from "@/types";

interface DataSourceListResponse {
  items: DataSourceConfig[];
  total: number;
}

export function useDataSources() {
  return useQuery<DataSourceListResponse>({
    queryKey: ["data-sources"],
    queryFn: () => api.get<DataSourceListResponse>("/data-sources"),
    staleTime: 5 * 60_000,
  });
}

export function useToggleDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.patch<DataSourceConfig>(`/data-sources/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data-sources"] }),
  });
}
