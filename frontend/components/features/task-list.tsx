"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useArchiveTask, useCreateTask, useTaskStatus } from "@/hooks/use-tasks";
import {
  DUE_TONE,
  LABEL,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from "@/lib/design";
import { dueLabel, sortTasks, TASK_STATUS_ORDER } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Task, TaskCreateInput, TaskStatus } from "@/types";

const MONO = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * The one task list, used on the dashboard, in the deal room and on /tasks.
 *
 * A checkbox rather than a status dropdown for the common case: the overwhelmingly
 * frequent state change is "this is done", and making that one click is the difference
 * between a list people keep and a list people abandon. The full four-state move lives
 * in the row menu and on the board.
 */
export function TaskList({
  tasks,
  isLoading,
  emptyMessage = "Nothing on the list.",
  /** Pre-fills the inline add row. Omit `defaults` to hide the add row entirely. */
  defaults,
  showProject = true,
  onEdit,
  className,
  addPlaceholder = "Add a task and press Enter",
}: {
  tasks: Task[];
  isLoading?: boolean;
  emptyMessage?: string;
  defaults?: TaskCreateInput | null;
  showProject?: boolean;
  onEdit?: (task: Task) => void;
  className?: string;
  addPlaceholder?: string;
}) {
  const ordered = sortTasks(tasks);

  return (
    <div className={cn("flex flex-col", className)}>
      {defaults !== undefined && defaults !== null && (
        <InlineAdd defaults={defaults} placeholder={addPlaceholder} />
      )}

      {isLoading ? (
        <ul className="divide-y" aria-busy="true" aria-label="Loading tasks">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-1 py-2.5">
              <span className="size-4 shrink-0 rounded border border-border bg-card" />
              <span className="h-3 flex-1 animate-pulse rounded bg-ink-100" />
            </li>
          ))}
        </ul>
      ) : ordered.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y">
          {ordered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              showProject={showProject}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Row ──────────────────────────────────────────────────────────────────── */

export function TaskRow({
  task,
  showProject = true,
  onEdit,
}: {
  task: Task;
  showProject?: boolean;
  onEdit?: (task: Task) => void;
}) {
  const move = useTaskStatus();
  const archive = useArchiveTask();
  const done = task.status === "DONE";
  const due = dueLabel(task.due_date);
  const priority = TASK_PRIORITY_META[task.priority];
  const status = TASK_STATUS_META[task.status];

  const setStatus = (next: TaskStatus) => {
    move.mutate(
      { id: task.id, status: next },
      { onError: (e: unknown) => toast.error((e as Error).message) },
    );
  };

  return (
    <li className="group flex items-center gap-2.5 px-1 py-2 text-sm">
      <input
        type="checkbox"
        checked={done}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onChange={() => setStatus(done ? "BACKLOG" : "DONE")}
        className="size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
      />

      {/* Priority reads as a dot, never a second chip — the row already carries one. */}
      {priority.showDot && (
        <span
          title={`${priority.label} priority`}
          aria-label={`${priority.label} priority`}
          className={cn("size-1.5 shrink-0 rounded-full", priority.dot)}
        />
      )}

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onEdit?.(task)}
          disabled={!onEdit}
          className={cn(
            "block w-full truncate text-left",
            done && "text-muted-foreground line-through",
            onEdit && "hover:text-primary-ink",
          )}
        >
          {task.title}
        </button>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {task.status !== "BACKLOG" && task.status !== "DONE" && (
            <span className={cn("inline-flex items-center gap-1", status.ink)}>
              <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
              {status.label}
            </span>
          )}
          {showProject && task.project_name && (
            <Link
              href={`/projects/${task.project_id}`}
              className="truncate hover:text-foreground hover:underline"
            >
              {task.project_name}
            </Link>
          )}
          {task.attached_to?.label && task.attached_to.type !== "PROJECT" && (
            <span className="truncate">· {task.attached_to.label}</span>
          )}
        </div>
      </div>

      {task.due_date && (
        <span
          className={cn("shrink-0 text-[11px] tabular-nums", DUE_TONE[due.tone])}
          style={MONO}
        >
          {due.text}
        </span>
      )}

      {task.assignee_name && <Avatar name={task.assignee_name} size="xs" />}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100"
              aria-label={`Actions for ${task.title}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="z-50 w-44">
          {onEdit && (
            <>
              <DropdownMenuItem onClick={() => onEdit(task)}>Edit task</DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {TASK_STATUS_ORDER.filter((s) => s !== task.status).map((s) => (
            <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
              Move to {TASK_STATUS_META[s].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              archive.mutate(
                { id: task.id, archived: false },
                {
                  onSuccess: () => toast.success("Task archived"),
                  onError: (e: unknown) => toast.error((e as Error).message),
                },
              )
            }
          >
            Archive task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/* ── Inline add ───────────────────────────────────────────────────────────── */

/**
 * Type a title, press Enter, done.
 *
 * This is the whole "an analyst can add to-dos" ask, and it deliberately does not open a
 * dialog: a to-do you have to fill a form out for is a to-do you write on paper instead.
 * Everything else about the task (assignee, due date, notes) is editable afterwards.
 */
function InlineAdd({
  defaults,
  placeholder,
}: {
  defaults: TaskCreateInput;
  placeholder: string;
}) {
  const [title, setTitle] = useState("");
  const create = useCreateTask();

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    // Cleared optimistically so a fast typist can queue several in a row without
    // waiting for each round trip.
    setTitle("");
    create.mutate(
      { ...defaults, title: trimmed },
      {
        onError: (e: unknown) => {
          setTitle(trimmed);
          toast.error((e as Error).message);
        },
      },
    );
  };

  return (
    <div className="flex items-center gap-2 border-b px-1 py-2">
      <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setTitle("");
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {title.trim() && (
        <span className={cn(LABEL, "shrink-0")}>Enter</span>
      )}
    </div>
  );
}
