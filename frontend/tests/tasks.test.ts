import { describe, it, expect } from "vitest";

import {
  countByStatus,
  daysBetween,
  dueLabel,
  groupByStatus,
  isOverdue,
  PRIORITY_RANK,
  sortTasks,
  TASK_STATUS_ORDER,
} from "@/lib/tasks";
import type { Task, TaskPriority, TaskStatus } from "@/types";

function task(over: Partial<Task> & { id: number }): Task {
  return {
    firm_id: 1,
    scope: "PROJECT",
    project_id: 1,
    mandate_id: null,
    company_id: null,
    contact_id: null,
    title: `Task ${over.id}`,
    notes: null,
    status: "BACKLOG",
    priority: "MEDIUM",
    due_date: null,
    assignee_id: null,
    created_by_id: 1,
    completed_at: null,
    archived_at: null,
    created_at: "2026-03-01T00:00:00",
    updated_at: "2026-03-01T00:00:00",
    assignee_name: null,
    created_by_name: null,
    project_name: "Alpha",
    attached_to: null,
    is_overdue: false,
    ...over,
  } as Task;
}

describe("priority ranking", () => {
  it("ranks HIGH above MEDIUM above LOW", () => {
    // The whole reason this exists: the values are strings, and sorting them
    // alphabetically gives MEDIUM > LOW > HIGH. The server ranks with sa.case() for
    // exactly the same reason.
    expect(PRIORITY_RANK.HIGH).toBeGreaterThan(PRIORITY_RANK.MEDIUM);
    expect(PRIORITY_RANK.MEDIUM).toBeGreaterThan(PRIORITY_RANK.LOW);

    const alphabetical = (["HIGH", "LOW", "MEDIUM"] as TaskPriority[]).sort();
    expect(alphabetical[0]).toBe("HIGH");
    expect(alphabetical[2]).toBe("MEDIUM");
  });
});

describe("sortTasks", () => {
  it("puts dated work above undated work", () => {
    const rows = [task({ id: 1 }), task({ id: 2, due_date: "2026-04-01" })];
    expect(sortTasks(rows).map((t) => t.id)).toEqual([2, 1]);
  });

  it("orders by due date, then priority, then newest", () => {
    const rows = [
      task({ id: 1, due_date: "2026-04-10", priority: "LOW" }),
      task({ id: 2, due_date: "2026-04-01", priority: "LOW" }),
      task({ id: 3, due_date: "2026-04-01", priority: "HIGH" }),
      task({ id: 4, due_date: "2026-04-01", priority: "HIGH" }),
    ];
    // Same date + same priority falls back to id DESC (newest first).
    expect(sortTasks(rows).map((t) => t.id)).toEqual([4, 3, 2, 1]);
  });

  it("does not mutate its input", () => {
    const rows = [task({ id: 1 }), task({ id: 2, due_date: "2026-04-01" })];
    const before = rows.map((t) => t.id);
    sortTasks(rows);
    expect(rows.map((t) => t.id)).toEqual(before);
  });
});

describe("isOverdue", () => {
  it("is true for a past date on open work", () => {
    expect(isOverdue({ due_date: "2026-03-01", status: "BACKLOG" }, "2026-03-05")).toBe(true);
  });

  it("is false once the work is done, whatever the date says", () => {
    expect(isOverdue({ due_date: "2026-03-01", status: "DONE" }, "2026-03-05")).toBe(false);
  });

  it("is false with no due date, and false on the due date itself", () => {
    expect(isOverdue({ due_date: null, status: "BACKLOG" }, "2026-03-05")).toBe(false);
    expect(isOverdue({ due_date: "2026-03-05", status: "BACKLOG" }, "2026-03-05")).toBe(false);
  });
});

describe("dueLabel", () => {
  it("names today, tomorrow and the near week", () => {
    expect(dueLabel("2026-03-05", "2026-03-05")).toEqual({ text: "Today", tone: "today" });
    expect(dueLabel("2026-03-06", "2026-03-05")).toEqual({ text: "Tomorrow", tone: "soon" });
    expect(dueLabel("2026-03-09", "2026-03-05")).toEqual({ text: "in 4d", tone: "soon" });
  });

  it("counts overdue days and singularises one", () => {
    expect(dueLabel("2026-03-04", "2026-03-05")).toEqual({
      text: "Overdue by 1d",
      tone: "overdue",
    });
    expect(dueLabel("2026-03-01", "2026-03-05").text).toBe("Overdue by 4d");
  });

  it("falls back to a date beyond a week out", () => {
    expect(dueLabel("2026-04-20", "2026-03-05")).toEqual({ text: "20 Apr", tone: "later" });
  });

  it("does not shift a date-only value across a timezone boundary", () => {
    // `new Date("2026-03-05")` parses as midnight UTC, which is 4 March for anyone west
    // of Greenwich. Comparing the strings instead is what stops work being marked
    // overdue a day early for half the world.
    expect(dueLabel("2026-03-05", "2026-03-05").tone).toBe("today");
    expect(dueLabel("2026-03-05", "2026-03-06").tone).toBe("overdue");
  });
});

describe("daysBetween", () => {
  it("counts whole days in both directions, across a month boundary", () => {
    expect(daysBetween("2026-03-05", "2026-03-09")).toBe(4);
    expect(daysBetween("2026-03-09", "2026-03-05")).toBe(-4);
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
  });
});

describe("groupByStatus", () => {
  it("always returns all four buckets in board order, even when empty", () => {
    const groups = groupByStatus([task({ id: 1, status: "BLOCKED" })]);
    expect(Object.keys(groups)).toEqual(TASK_STATUS_ORDER as TaskStatus[]);
    expect(groups.BLOCKED.map((t) => t.id)).toEqual([1]);
    expect(groups.BACKLOG).toEqual([]);
    expect(groups.DONE).toEqual([]);
  });

  it("sorts inside each column", () => {
    const groups = groupByStatus([
      task({ id: 1, due_date: "2026-04-10" }),
      task({ id: 2, due_date: "2026-04-01" }),
    ]);
    expect(groups.BACKLOG.map((t) => t.id)).toEqual([2, 1]);
  });
});

describe("countByStatus", () => {
  it("counts every status and zeroes the rest", () => {
    const counts = countByStatus([
      task({ id: 1, status: "DONE" }),
      task({ id: 2, status: "DONE" }),
      task({ id: 3, status: "IN_PROGRESS" }),
    ]);
    expect(counts).toEqual({ BACKLOG: 0, IN_PROGRESS: 1, BLOCKED: 0, DONE: 2 });
  });
});
