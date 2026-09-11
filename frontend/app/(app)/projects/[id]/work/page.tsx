"use client";

/**
 * Project work — the declared counterpart to the cadence the schedule derives.
 *
 * This is where the global "My work → Backlog / In progress / Blocked / Done" navigation
 * went. Moving it here was not a relocation of the same screen: a cross-project task
 * inbox and a project's work list answer different questions, and only the second one
 * can show what a task is *attached* to without repeating the project name on every row.
 *
 * Three lenses over one fetch, because the same list is read three ways:
 *   • Due    — what is late, today, this week. The lead's question.
 *   • Board  — backlog / in progress / blocked / done. The stand-up's question.
 *   • List   — everything, flat, with an inline add. The doer's question.
 *
 * Personal tasks (owner-only, attached to nobody) never appear here by construction:
 * they have no project, and this view is scoped to one.
 */

import { use, useMemo, useState } from "react";
import { Columns3, ListTodo, Plus, CalendarClock } from "lucide-react";

import { TaskBoard } from "@/components/features/task-board";
import { TaskDialog } from "@/components/features/task-dialog";
import { TaskList } from "@/components/features/task-list";
import { useProjectShell } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/use-tasks";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
import {
  LABEL,
  LATE_TOKEN,
  MONO,
  PANEL,
  SEG_GROUP,
  SEG_ITEM,
  SEG_ITEM_OFF,
  SEG_ITEM_ON,
  SELECT_CLS,
  TASK_STATUS_META,
  TOGGLE_OFF,
  TOGGLE_ON,
} from "@/lib/design";
import { bucketTasksByDue } from "@/lib/project";
import { todayISO } from "@/lib/tasks";
import { enumParam, intParam, type ParamSpec } from "@/lib/table-url-state";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

/** MODULE SCOPE — see the note in `project-workspace.tsx`. */
const WORK_SPEC = {
  lens: enumParam(["due", "board", "list"] as const, "due"),
  assignee: intParam(0),
  status: enumParam(["", "BACKLOG", "IN_PROGRESS", "BLOCKED", "DONE"] as const, ""),
} satisfies ParamSpec;

const LENSES = [
  { id: "due", label: "Due", icon: CalendarClock },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "list", label: "List", icon: ListTodo },
] as const;

export default function ProjectWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const { project, openNewTask } = useProjectShell();

  const [urlState, patchUrl] = useTableUrlState(WORK_SPEC);
  const { lens, assignee, status } = urlState;

  const [editing, setEditing] = useState<Task | null>(null);

  const { data: users } = useUsers();
  const { user } = useAuth();

  // The board needs its Done column; the other two lenses hide finished work unless a
  // status filter names it, because a project list that keeps everything it ever
  // finished stops being a list of work.
  const { data, isLoading } = useTasks({
    project_id: projectId,
    assignee_id: assignee || undefined,
    status: status ? [status as TaskStatus] : undefined,
    include_done: lens === "board" || status === "DONE",
  });

  const tasks = useMemo(() => data?.items ?? [], [data]);
  const buckets = useMemo(() => bucketTasksByDue(tasks, todayISO()), [tasks]);
  const summary = data?.summary;

  const defaults = { title: "", project_id: projectId };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={SEG_GROUP} role="group" aria-label="Work lens">
          {LENSES.map((l) => {
            const Icon = l.icon;
            const active = lens === l.id;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={active}
                onClick={() => patchUrl({ lens: l.id })}
                className={cn(SEG_ITEM, active ? SEG_ITEM_ON : SEG_ITEM_OFF)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {l.label}
              </button>
            );
          })}
        </div>

        {/*
          "Mine" is a toggle, not the twelfth entry in a select.
          It is the single most-used answer to "whose work", and burying the person's
          own name in an alphabetical list of the firm makes the commonest filter the
          slowest one. The select still holds everybody, including them.
        */}
        {user && (
          <button
            type="button"
            aria-pressed={assignee === user.id}
            onClick={() => patchUrl({ assignee: assignee === user.id ? 0 : user.id })}
            className={cn(
              "inline-flex h-8 items-center rounded-lg border px-2.5 text-xs transition-colors",
              assignee === user.id ? TOGGLE_ON : TOGGLE_OFF,
            )}
          >
            Mine
          </button>
        )}

        <select
          value={assignee || ""}
          onChange={(e) => patchUrl({ assignee: Number(e.target.value) || 0 })}
          className={SELECT_CLS}
          aria-label="Filter by assignee"
        >
          <option value="">Anyone</option>
          {(users?.items ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>

        {/* A status filter beside a board would fight the board's own columns. */}
        {lens !== "board" && (
          <select
            value={status}
            onChange={(e) => patchUrl({ status: e.target.value as typeof status })}
            className={SELECT_CLS}
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            {(["BACKLOG", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_META[s].label}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-3">
          {summary && (
            <p className="hidden text-xs text-muted-foreground sm:block">
              <span className="font-medium tabular-nums text-foreground" style={MONO}>
                {summary.open}
              </span>{" "}
              open
              {summary.overdue > 0 && (
                <>
                  {" · "}
                  <span className={LATE_TOKEN} style={MONO}>
                    {summary.overdue}
                  </span>{" "}
                  overdue
                </>
              )}
            </p>
          )}
          {/* The shell owns the new-task dialog, so opening it from here cannot
              collide with this page's own edit dialog. */}
          <Button size="sm" onClick={() => openNewTask()}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add task
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Work someone declared on {project.name} — the counterpart to the outreach cadence,
        which derives its own.
      </p>

      {/* ── The lens ───────────────────────────────────────────────────── */}
      {lens === "board" ? (
        isLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-ink-100" />
        ) : (
          <TaskBoard tasks={tasks} onEdit={setEditing} showProject={false} />
        )
      ) : lens === "due" ? (
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="h-48 animate-pulse rounded-lg bg-ink-100" />
          ) : buckets.length === 0 ? (
            <div className={cn(PANEL, "py-14 text-center")}>
              <p className="text-sm font-medium">No open work on this project.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Declared work lives here; the outreach the cadence derives lives in the
                workspace.
              </p>
            </div>
          ) : (
            buckets.map((bucket) => (
              <section key={bucket.key} className={cn(PANEL, "px-3 py-1")}>
                <p
                  className={cn(
                    LABEL,
                    "flex items-center gap-1.5 px-1 pb-1 pt-2",
                    bucket.key === "overdue" && "text-foreground",
                  )}
                >
                  {bucket.key === "overdue" && (
                    <span className="size-1.5 rounded-full bg-danger" aria-hidden />
                  )}
                  {bucket.label}
                  <span className="tabular-nums" style={MONO}>
                    {bucket.tasks.length}
                  </span>
                </p>
                <TaskList
                  tasks={bucket.tasks}
                  onEdit={setEditing}
                  showProject={false}
                  defaults={null}
                />
              </section>
            ))
          )}
        </div>
      ) : (
        <div className={cn(PANEL, "px-3 py-1")}>
          <TaskList
            tasks={tasks}
            isLoading={isLoading}
            onEdit={setEditing}
            showProject={false}
            defaults={defaults}
            addPlaceholder="Add a task to this project and press Enter"
            emptyMessage="No open tasks on this project."
          />
        </div>
      )}

      <TaskDialog
        task={editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        defaults={defaults}
      />
    </div>
  );
}
