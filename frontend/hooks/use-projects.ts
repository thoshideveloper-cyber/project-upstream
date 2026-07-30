"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project, ProjectDetail } from "@/types";

interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
}

export function useProjects(includeArchived = false) {
  return useQuery<ProjectListResponse>({
    queryKey: ["projects", { includeArchived }],
    queryFn: () => {
      // Pull the whole desk in one page — the list is small (one per client) and the
      // command-line vitals sum across every row, so paging would under-count.
      const p = new URLSearchParams({ page_size: "100" });
      if (includeArchived) p.set("include_archived", "true");
      return api.get<ProjectListResponse>(`/projects?${p.toString()}`);
    },
    staleTime: 30_000,
  });
}

export function useProject(id: number) {
  return useQuery<ProjectDetail>({
    queryKey: ["project", id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    staleTime: 30_000,
    enabled: id > 0,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; client_name: string }) =>
      api.post<Project>("/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; client_name?: string } }) =>
      api.patch<Project>(`/projects/${id}`, data),
    onSuccess: (_p, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      archived
        ? api.post<{ detail: string }>(`/projects/${id}/unarchive`)
        : api.del<{ detail: string }>(`/projects/${id}`),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}
