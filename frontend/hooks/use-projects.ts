"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Project,
  ProjectDeletionPreview,
  ProjectDetail,
  ProjectMember,
} from "@/types";

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


/* ── Members ──────────────────────────────────────────────────────────────── */

export function useProjectMembers(projectId: number) {
  return useQuery<{ items: ProjectMember[] }>({
    queryKey: ["project-members", projectId],
    queryFn: () => api.get<{ items: ProjectMember[] }>(`/projects/${projectId}/members`),
    enabled: projectId > 0,
    staleTime: 30_000,
  });
}

function invalidateMembers(qc: ReturnType<typeof useQueryClient>, projectId: number) {
  qc.invalidateQueries({ queryKey: ["project-members", projectId] });
  // Membership also changes what the assignee picker offers and what the row shows.
  qc.invalidateQueries({ queryKey: ["projects"] });
  qc.invalidateQueries({ queryKey: ["project", projectId] });
  qc.invalidateQueries({ queryKey: ["activity"] });
}

export function useAssignProjectMember(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      api.post<{ detail: string }>(`/projects/${projectId}/assignments`, {
        user_id: userId,
      }),
    onSuccess: () => invalidateMembers(qc, projectId),
  });
}

export function useUnassignProjectMember(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      api.del<{ detail: string }>(`/projects/${projectId}/assignments/${userId}`),
    onSuccess: () => invalidateMembers(qc, projectId),
  });
}

/* ── Permanent delete ─────────────────────────────────────────────────────── */

/**
 * The dry run behind the delete dialog.
 *
 * Fetched only when the dialog is actually open (`enabled`), and never cached for long:
 * the counts are the whole argument the dialog makes, and a stale "412 companies" beside
 * a name box is worse than a spinner.
 */
export function useDeletionPreview(projectId: number, enabled: boolean) {
  return useQuery<ProjectDeletionPreview>({
    queryKey: ["project-deletion-preview", projectId],
    queryFn: () =>
      api.get<ProjectDeletionPreview>(`/projects/${projectId}/deletion-preview`),
    enabled: enabled && projectId > 0,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.post<{ deleted: boolean; total: number; counts: Record<string, number> }>(
        `/projects/${id}/permanent-delete`,
        { confirm_project_name: name },
      ),
    onSuccess: (_r, vars) => {
      // Everything downstream of a project just changed, and several read models now
      // reference rows that no longer exist. Bust broadly rather than surgically.
      for (const key of [
        ["projects"],
        ["project"],
        ["mandates"],
        ["mandate"],
        ["companies"],
        ["company"],
        ["contacts"],
        ["schedule"],
        ["my-book"],
        ["analytics"],
        ["tasks"],
        ["task-summary"],
        ["activity"],
      ]) {
        qc.invalidateQueries({ queryKey: key });
      }
      qc.removeQueries({ queryKey: ["project", vars.id] });
    },
  });
}
