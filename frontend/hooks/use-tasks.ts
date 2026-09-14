"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  Task,
  TaskCreateInput,
  TaskListResponse,
  TaskStatus,
  TaskSummary,
  TaskUpdateInput,
} from "@/types";

export interface TaskFilters {
  project_id?: number;
  mandate_id?: number;
  company_id?: number;
  contact_id?: number;
  assignee_id?: number;
  status?: TaskStatus[];
  priority?: string;
  scope?: string;
  overdue?: boolean;
  q?: string;
  include_done?: boolean;
  page_size?: number;
}

function toQuery(filters: TaskFilters): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      // `status` is repeatable server-side — one param per value, not a joined string.
      for (const v of value) p.append(key, String(v));
    } else if (typeof value === "boolean") {
      if (value) p.set(key, "true");
    } else {
      p.set(key, String(value));
    }
  }
  if (!p.has("page_size")) p.set("page_size", "200");
  return p.toString();
}

/**
 * Every task read model hangs off the `["tasks"]` prefix, so one `invalidateQueries`
 * refreshes the list, the board, the sidebar counts and the deal-room vitals together.
 * They are all views of one number; letting them drift is how a sidebar ends up
 * claiming 4 open when the list beneath it shows 3.
 */
function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["task-summary"] });
  // A task count also sits on the project rows and the deal-room header.
  qc.invalidateQueries({ queryKey: ["projects"] });
  qc.invalidateQueries({ queryKey: ["project"] });
  qc.invalidateQueries({ queryKey: ["activity"] });
}

export function useTasks(filters: TaskFilters = {}, enabled = true) {
  const qs = toQuery(filters);
  return useQuery<TaskListResponse>({
    queryKey: ["tasks", qs],
    queryFn: () => api.get<TaskListResponse>(`/tasks?${qs}`),
    staleTime: 15_000,
    enabled,
  });
}

export function useTaskSummary(projectId?: number) {
  return useQuery<TaskSummary>({
    queryKey: ["task-summary", projectId ?? null],
    queryFn: () =>
      api.get<TaskSummary>(
        projectId ? `/tasks/summary?project_id=${projectId}` : "/tasks/summary",
      ),
    staleTime: 15_000,
  });
}

export function useTask(id: number) {
  return useQuery<Task>({
    queryKey: ["task", id],
    queryFn: () => api.get<Task>(`/tasks/${id}`),
    enabled: id > 0,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskCreateInput) => api.post<Task>("/tasks", data),
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskUpdateInput }) =>
      api.patch<Task>(`/tasks/${id}`, data),
    onSuccess: (_t, vars) => {
      invalidateTasks(qc);
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
    },
  });
}

/**
 * Status moves, applied optimistically.
 *
 * This is the one mutation that has to feel instant: dragging a card across a board and
 * watching it snap back for 200ms before landing reads as a failed drag. Mirrors
 * `useUpdateCompany` in `use-companies.ts` — cancel in-flight refetches, snapshot every
 * matching cache entry, patch, and roll the snapshot back on error.
 */
export function useTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      api.patch<Task>(`/tasks/${id}/status`, { status }),

    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const previous = qc.getQueriesData<TaskListResponse>({ queryKey: ["tasks"] });

      for (const [key, data] of previous) {
        if (!data?.items) continue;
        qc.setQueryData<TaskListResponse>(key, {
          ...data,
          items: data.items.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status,
                  // Keep the row honest while the server catches up: a task that is
                  // done is not overdue, whatever its due date says.
                  is_overdue: status === "DONE" ? false : t.is_overdue,
                  completed_at:
                    status === "DONE" ? new Date().toISOString() : null,
                }
              : t,
          ),
        });
      }
      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
    },

    onSettled: () => invalidateTasks(qc),
  });
}

export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    // The two halves return different shapes (a restored Task vs `{detail}`), so the
    // result is deliberately untyped here — nothing reads it; the invalidation does
    // the work.
    mutationFn: ({ id, archived }: { id: number; archived: boolean }): Promise<unknown> =>
      archived
        ? api.post<Task>(`/tasks/${id}/unarchive`)
        : api.del<{ detail: string }>(`/tasks/${id}`),
    onSuccess: () => invalidateTasks(qc),
  });
}
