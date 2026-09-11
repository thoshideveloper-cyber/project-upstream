"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { useTaskStatus } from "@/hooks/use-tasks";
import { DUE_TONE, TASK_PRIORITY_META, TASK_STATUS_META } from "@/lib/design";
import { dueLabel, groupByStatus, TASK_STATUS_ORDER } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

const MONO = { fontVariantNumeric: "tabular-nums" } as const;

const COLUMN_HINT: Record<TaskStatus, string> = {
  BACKLOG: "Written down, not started",
  IN_PROGRESS: "Someone is on it now",
  BLOCKED: "Waiting on something else",
  DONE: "Finished",
};

/**
 * Four columns, drag to move.
 *
 * Unlike the pipeline board — where a column is never written directly, because a
 * company's status is a *consequence* of the outreach log — a task's status is simply
 * a field somebody sets. So this board writes it, with no confirmation and no dialog.
 * The drag mechanics are the ones already proven in `pipeline-board.tsx`; the rules
 * around them are deliberately much thinner.
 */
export function TaskBoard({
  tasks,
  onEdit,
  showProject = true,
}: {
  tasks: Task[];
  onEdit?: (task: Task) => void;
  showProject?: boolean;
}) {
  const board = groupByStatus(tasks);
  const move = useTaskStatus();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const dragging = tasks.find((t) => t.id === dragId) ?? null;

  const drop = (target: TaskStatus) => {
    setOverCol(null);
    const task = dragging;
    setDragId(null);
    if (!task || task.status === target) return;
    move.mutate(
      { id: task.id, status: target },
      { onError: (e: unknown) => toast.error((e as Error).message) },
    );
  };

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2"
      role="group"
      aria-label="Task board"
    >
      {TASK_STATUS_ORDER.map((status) => {
        const meta = TASK_STATUS_META[status];
        const items = board[status];
        const isOver = overCol === status && dragId != null;

        return (
          <section
            key={status}
            aria-label={`${meta.label} — ${items.length} ${items.length === 1 ? "task" : "tasks"}`}
            className={cn(
              "flex w-[260px] shrink-0 flex-col rounded-lg border bg-muted/20 transition-colors",
              isOver && "border-border-strong bg-accent ring-1 ring-border-strong",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overCol !== status) setOverCol(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(status);
            }}
          >
            <div className="border-b px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", meta.dot)}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-semibold">{meta.label}</span>
                </div>
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                {COLUMN_HINT[status]}
              </p>
            </div>

            <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">
              {items.length === 0 && (
                <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">
                  Nothing here
                </p>
              )}
              {items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showProject={showProject}
                  onEdit={onEdit}
                  dragging={dragId === task.id}
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                  onMove={(next) =>
                    move.mutate(
                      { id: task.id, status: next },
                      { onError: (e: unknown) => toast.error((e as Error).message) },
                    )
                  }
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  showProject,
  onEdit,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  task: Task;
  showProject: boolean;
  onEdit?: (task: Task) => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  const due = dueLabel(task.due_date);
  const priority = TASK_PRIORITY_META[task.priority];

  return (
    <article
      draggable
      onDragStart={(e) => {
        // A drag begun on the card's own controls is a mis-grab, not a move.
        if ((e.target as HTMLElement).closest("button,a,select,input")) {
          e.preventDefault();
          return;
        }
        onDragStart();
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag with an empty transfer.
        e.dataTransfer.setData("text/plain", String(task.id));
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-lg border bg-card p-2.5 text-xs shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          className="mt-0.5 size-3 shrink-0 text-ink-300 group-hover:text-muted-foreground"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => onEdit?.(task)}
          disabled={!onEdit}
          className="min-w-0 flex-1 text-left text-xs font-medium leading-snug hover:text-primary-ink disabled:hover:text-foreground"
        >
          {task.title}
        </button>
        {priority.showDot && (
          <span
            title={`${priority.label} priority`}
            className={cn("mt-1 size-1.5 shrink-0 rounded-full", priority.dot)}
          />
        )}
      </div>

      {(showProject && task.project_name) || task.attached_to?.label ? (
        <p className="mt-1.5 truncate pl-[18px] text-[10px] text-muted-foreground">
          {task.attached_to?.label ?? task.project_name}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 pl-[18px]">
        <span
          className={cn("text-[10px] tabular-nums", DUE_TONE[due.tone])}
          style={MONO}
        >
          {task.due_date ? due.text : ""}
        </span>
        <div className="flex items-center gap-1.5">
          {task.assignee_name && <Avatar name={task.assignee_name} size="xs" />}
          {/* Keyboard equivalent for the drag — a board that only responds to a mouse
              is a board half the desk cannot use. */}
          <select
            aria-label={`Move ${task.title}`}
            value={task.status}
            onChange={(e) => onMove(e.target.value as TaskStatus)}
            className="h-5 rounded border border-transparent bg-transparent text-[10px] text-muted-foreground hover:border-input focus:border-input"
          >
            {TASK_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_META[s].short}
              </option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}
