"use client";

import { useState } from "react";
import { Columns3, List, Plus, Search, X } from "lucide-react";

import { TaskBoard } from "@/components/features/task-board";
import { TaskDialog } from "@/components/features/task-dialog";
import { TaskList } from "@/components/features/task-list";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useUsers } from "@/hooks/use-users";
import {
  MONO,
  PANEL,
  SEG_GROUP,
  SEG_ITEM,
  SEG_ITEM_OFF,
  SEG_ITEM_ON,
  SELECT_CLS,
  TASK_STATUS_META,
} from "@/lib/design";
import { TASK_STATUS_ORDER } from "@/lib/tasks";
import {
  boolParam,
  enumParam,
  intParam,
  stringParam,
  type ParamSpec,
} from "@/lib/table-url-state";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

/**
 * MODULE SCOPE, not inline. `useTableUrlState` intentionally leaves the spec out of its
 * effect deps, so a per-render object would re-hydrate from the URL on every render.
 */
const SPEC = {
  view: enumParam(["list", "board"] as const, "list"),
  status: enumParam(
    ["", "BACKLOG", "IN_PROGRESS", "BLOCKED", "DONE"] as const,
    "",
  ),
  assignee: intParam(0),
  project: intParam(0),
  overdue: boolParam(false),
  q: stringParam(""),
} satisfies ParamSpec;

/**
 * My work — every task assigned to you (or, for a partner, the desk), across projects,
 * including personal tasks that belong to no project.
 *
 * Status is a row of view tabs with counts, the way an issue tracker presents its
 * lanes; the filters sit beneath as one toolbar; the list or board is the page.
 */
export default function TasksPage() {
  const { user } = useAuth();
  const [urlState, patchUrl] = useTableUrlState(SPEC);
  const { view, status, assignee, project, overdue, q } = urlState;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const { data: users } = useUsers();
  const { data: projects } = useProjects(false);

  const { data, isLoading } = useTasks({
    status: status ? [status as TaskStatus] : undefined,
    assignee_id: assignee || undefined,
    project_id: project || undefined,
    overdue: overdue || undefined,
    q: q || undefined,
    // The board needs its fourth column, so a board view always asks for DONE. The list
    // hides it unless a status filter names it — a to-do list that grows for ever is a
    // to-do list nobody opens.
    include_done: view === "board" || status === "DONE",
  });

  const tasks = data?.items ?? [];
  const summary = data?.summary;

  const openEdit = (task: Task) => {
    setEditing(task);
    setDialogOpen(true);
  };
  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const filtersActive = !!(assignee || project || overdue || q);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My work"
        description={
          summary ? (
            <>
              <span className="font-medium text-foreground" style={MONO}>
                {summary.open}
              </span>{" "}
              open
              {summary.overdue > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-danger-ink" style={MONO}>
                    {summary.overdue}
                  </span>{" "}
                  overdue
                </>
              )}
              {summary.due_today > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-warning-ink" style={MONO}>
                    {summary.due_today}
                  </span>{" "}
                  due today
                </>
              )}
              <span className="text-muted-foreground"> — work people declared, beside what the cadence derives.</span>
            </>
          ) : (
            "What the desk has declared, as opposed to what the cadence derived."
          )
        }
        actions={
          <>
            <div className={SEG_GROUP} role="tablist" aria-label="Layout">
              {(
                [
                  { id: "list" as const, label: "List", Icon: List },
                  { id: "board" as const, label: "Board", Icon: Columns3 },
                ]
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => patchUrl({ view: id })}
                  className={cn(SEG_ITEM, view === id ? SEG_ITEM_ON : SEG_ITEM_OFF)}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <Button onClick={openNew}>
              <Plus aria-hidden />
              New task
            </Button>
          </>
        }
      >
        {/* Status lanes as view tabs — each with its count. */}
        <nav aria-label="Filter by status" className="flex items-center gap-5 overflow-x-auto border-b border-border">
          <StatusTab
            label="All open"
            count={summary?.open}
            active={!status}
            onClick={() => patchUrl({ status: "" })}
          />
          {TASK_STATUS_ORDER.map((s) => (
            <StatusTab
              key={s}
              label={TASK_STATUS_META[s].label}
              dot={TASK_STATUS_META[s].dot}
              count={summary?.by_status?.[s]}
              active={status === s}
              onClick={() => patchUrl({ status: status === s ? "" : s })}
            />
          ))}
        </nav>
      </PageHeader>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => patchUrl({ q: e.target.value })}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="w-56 pl-8"
          />
        </div>

        <select
          aria-label="Filter by assignee"
          value={assignee || ""}
          onChange={(e) => patchUrl({ assignee: Number(e.target.value) || 0 })}
          className={SELECT_CLS}
        >
          <option value="">Anyone</option>
          {user && <option value={user.id}>Me</option>}
          {(users?.items ?? [])
            .filter((u) => u.id !== user?.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
        </select>

        <select
          aria-label="Filter by project"
          value={project || ""}
          onChange={(e) => patchUrl({ project: Number(e.target.value) || 0 })}
          className={SELECT_CLS}
        >
          <option value="">Every project</option>
          {(projects?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={overdue}
          onClick={() => patchUrl({ overdue: !overdue })}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm shadow-xs transition-colors",
            overdue
              ? "border-danger-line bg-danger-soft font-medium text-danger-ink"
              : "border-input bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", overdue ? "bg-danger" : "bg-ink-300")} aria-hidden />
          Overdue only
        </button>

        {filtersActive && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() =>
              patchUrl({
                assignee: 0,
                project: 0,
                overdue: false,
                q: "",
              })
            }
          >
            <X aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      {/* ── The work ─────────────────────────────────────────────────────── */}
      {view === "board" ? (
        isLoading ? (
          <BoardSkeleton />
        ) : (
          <TaskBoard tasks={tasks} onEdit={openEdit} />
        )
      ) : (
        <div className={cn(PANEL, "px-3 py-1")}>
          <TaskList
            tasks={tasks}
            isLoading={isLoading}
            onEdit={openEdit}
            emptyMessage={
              filtersActive || status
                ? "No tasks match these filters."
                : "Nothing on the list. Add the first one above."
            }
            defaults={project ? { title: "", project_id: project } : { title: "" }}
            addPlaceholder={
              project
                ? "Add a task to this project and press Enter"
                : "Add a private task and press Enter"
            }
          />
        </div>
      )}

      <TaskDialog
        task={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaults={project ? { title: "", project_id: project } : undefined}
      />
    </div>
  );
}

function StatusTab({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "-mb-px flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm transition-colors outline-none focus-visible:text-foreground",
        active
          ? "border-foreground font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {dot && <span className={dot} aria-hidden />}
      {label}
      {count != null && (
        <span
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-muted px-1 text-[11px] font-medium leading-none text-muted-foreground ring-1 ring-inset ring-border"
          style={MONO}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading the board">
      {TASK_STATUS_ORDER.map((s) => (
        <div key={s} className="w-[260px] shrink-0 rounded-lg bg-muted p-2 ring-1 ring-border">
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-ink-100" />
          {[0, 1].map((i) => (
            <div key={i} className="mb-2 h-14 animate-pulse rounded-lg bg-card ring-1 ring-border" />
          ))}
        </div>
      ))}
    </div>
  );
}
