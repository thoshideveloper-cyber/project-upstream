/**
 * Task domain logic — React-free, so it can be unit-tested without a renderer.
 *
 * The same split as `lib/outreach-timeline.ts` ↔ `components/features/outreach-timeline.tsx`:
 * the rules about what a task *is* live here; the components only render them.
 *
 * Cadence dates are computed server-side (CLAUDE.md rule 2) and this file does not touch
 * them. Task due dates are different — they are a plain field on the task, not a derived
 * schedule — so comparing one to today in the browser is a display concern, not a
 * re-implementation of the cadence engine. The server still owns the authoritative
 * `is_overdue` on every row; `isOverdue` here exists for rows being optimistically
 * updated, where no server answer has arrived yet.
 */

import type { Task, TaskPriority, TaskStatus } from "@/types";

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "BACKLOG",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
];

export const TASK_PRIORITY_ORDER: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];

/** HIGH > MEDIUM > LOW. The server ranks with a sa.case() for the same reason: the
 *  values are strings, and alphabetically MEDIUM beats LOW beats HIGH. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const OPEN_STATUSES: TaskStatus[] = ["BACKLOG", "IN_PROGRESS", "BLOCKED"];

export function isOpen(status: TaskStatus): boolean {
  return status !== "DONE";
}

/* ── Dates ────────────────────────────────────────────────────────────────── */

/** Today as `YYYY-MM-DD` in the browser's own zone, for comparing to a date-only field. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isOverdue(task: Pick<Task, "due_date" | "status">, today = todayISO()): boolean {
  if (!task.due_date || task.status === "DONE") return false;
  return task.due_date < today;
}

/**
 * "Overdue by 3d" / "Today" / "Tomorrow" / "in 4d" / "12 Mar".
 *
 * Dates are compared as strings, not as `Date` objects: `due_date` is a date-only field
 * and `new Date("2026-03-12")` parses as midnight **UTC**, which is the previous day for
 * anyone west of Greenwich. That off-by-one would mark work overdue a day early.
 */
export function dueLabel(
  due: string | null | undefined,
  today = todayISO(),
): { text: string; tone: "overdue" | "today" | "soon" | "later" | "none" } {
  if (!due) return { text: "—", tone: "none" };
  if (due === today) return { text: "Today", tone: "today" };

  const days = daysBetween(today, due);
  if (days < 0) {
    const n = Math.abs(days);
    return { text: n === 1 ? "Overdue by 1d" : `Overdue by ${n}d`, tone: "overdue" };
  }
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  if (days <= 7) return { text: `in ${days}d`, tone: "soon" };
  const d = new Date(`${due}T00:00:00`);
  const month = d.toLocaleString("en-GB", { month: "short" });
  return { text: `${d.getDate()} ${month}`, tone: "later" };
}

/** Whole days from `a` to `b`, both `YYYY-MM-DD`. Negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.UTC(...split(b)) - Date.UTC(...split(a));
  return Math.round(ms / 86_400_000);
}

function split(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, (m ?? 1) - 1, d ?? 1];
}

/* ── Ordering and grouping ────────────────────────────────────────────────── */

/**
 * The list's default order, mirroring the server's: dated work first, soonest first,
 * then priority, then newest.
 *
 * The client re-sorts rather than trusting arrival order because optimistic updates
 * insert rows locally, and a locally-added task should land where it belongs rather
 * than at the end until the next refetch.
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aUndated = a.due_date ? 0 : 1;
    const bUndated = b.due_date ? 0 : 1;
    if (aUndated !== bUndated) return aUndated - bUndated;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (p !== 0) return p;
    return b.id - a.id;
  });
}

/** One bucket per status, always all four, in board order — empty columns still render. */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const out = {
    BACKLOG: [] as Task[],
    IN_PROGRESS: [] as Task[],
    BLOCKED: [] as Task[],
    DONE: [] as Task[],
  };
  for (const t of tasks) out[t.status].push(t);
  for (const key of TASK_STATUS_ORDER) out[key] = sortTasks(out[key]);
  return out;
}

export function countByStatus(tasks: Task[]): Record<TaskStatus, number> {
  const out = { BACKLOG: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0 };
  for (const t of tasks) out[t.status] += 1;
  return out;
}
