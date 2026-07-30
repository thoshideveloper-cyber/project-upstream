import { describe, it, expect } from "vitest";

import {
  applyStatusMove,
  buildBoard,
  columnOf,
  COLUMN_IDS,
  legalTargets,
  planMove,
  PIPELINE_COLUMNS,
  type PipelineColumnId,
} from "@/lib/pipeline-board";
import type { Company, CompanyStatus, ScheduleStatus } from "@/types";

/**
 * Unit tests for the P5 pipeline board's move rules. These are the CLAUDE.md
 * guarantees expressed as assertions: a column is never a writable field, the
 * event log always beats a hand-written status, and the clock cannot start
 * backwards.
 */

let nextId = 1;
function co(partial: Partial<Company> & { status: CompanyStatus }): Company {
  return {
    id: partial.id ?? nextId++,
    firm_id: 1,
    mandate_id: 5,
    company_name: partial.company_name ?? "Glenmark Pharma",
    hq: null,
    type: "TARGET",
    rationale: null,
    revenue_source: null,
    revenue_inr_cr: null,
    headcount: null,
    website: null,
    linkedin: null,
    relevant_investments: null,
    bucket: null,
    category: "STRATEGIC",
    source: "PROPRIETARY",
    source_quality: "HIGH",
    created_by_id: 1,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    schedule_status: (partial.schedule_status ?? "ACTIVE") as ScheduleStatus | null,
    cycle_number: 1,
    is_cold: false,
    initial_date: "2026-01-01",
    next_due_date: "2026-02-01",
    days_remaining: 7,
    is_overdue: false,
    primary_contact: null,
    ...partial,
  } as Company;
}

describe("column model", () => {
  it("covers every CompanyStatus exactly once", () => {
    const ids = PIPELINE_COLUMNS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "NOT_CONTACTED",
      "CONTACTED",
      "RESPONDED",
      "INTERESTED",
      "DECLINED",
      "BOUNCED",
    ]);
  });

  it("puts a company in the column matching its status", () => {
    expect(columnOf(co({ status: "RESPONDED" }))).toBe("RESPONDED");
  });
});

describe("planMove — a column is not a writable field", () => {
  it("refuses every drop into Not contacted (nothing un-sends an email)", () => {
    for (const status of ["CONTACTED", "RESPONDED", "INTERESTED", "DECLINED", "BOUNCED"] as const) {
      const move = planMove(co({ status }), "NOT_CONTACTED");
      expect(move.kind, `from ${status}`).toBe("refused");
    }
  });

  it("treats the same column as a no-op, not a write", () => {
    expect(planMove(co({ status: "CONTACTED" }), "CONTACTED").kind).toBe("noop");
    expect(planMove(co({ status: "DECLINED" }), "DECLINED").kind).toBe("noop");
  });

  it("turns 'start chasing' into logging the initial email, with the anchor warning", () => {
    const move = planMove(
      co({ status: "NOT_CONTACTED", schedule_status: "AWAITING_INITIAL" }),
      "CONTACTED",
    );
    expect(move).toMatchObject({ kind: "event", eventType: "INITIAL_EMAIL" });
    if (move.kind === "event") expect(move.consequence).toMatch(/anchor/i);
  });

  it("logs an event — never a status write — for Replied and Bounced", () => {
    expect(planMove(co({ status: "CONTACTED" }), "RESPONDED")).toMatchObject({
      kind: "event",
      eventType: "RESPONSE",
    });
    expect(planMove(co({ status: "CONTACTED" }), "BOUNCED")).toMatchObject({
      kind: "event",
      eventType: "BOUNCE",
    });
  });

  it("says the cadence stops, on both stopping moves", () => {
    for (const target of ["RESPONDED", "BOUNCED"] as const) {
      const move = planMove(co({ status: "CONTACTED" }), target);
      if (move.kind !== "event") throw new Error("expected an event move");
      expect(move.consequence).toMatch(/stops the cadence/i);
    }
  });
});

describe("planMove — the log beats a hand-written status", () => {
  it("refuses dragging a replied company back into the cadence", () => {
    const move = planMove(co({ status: "RESPONDED" }), "CONTACTED");
    expect(move.kind).toBe("refused");
    if (move.kind === "refused") expect(move.reason).toMatch(/restart the cadence/i);
  });

  it("refuses dragging a bounced company back into the cadence", () => {
    const move = planMove(co({ status: "BOUNCED" }), "CONTACTED");
    expect(move.kind).toBe("refused");
    if (move.kind === "refused") expect(move.reason).toMatch(/address/i);
  });

  it("does let a manual flag be cleared back to what the log says", () => {
    for (const status of ["INTERESTED", "DECLINED"] as const) {
      expect(planMove(co({ status }), "CONTACTED")).toMatchObject({
        kind: "status",
        status: "CONTACTED",
        undoable: true,
      });
    }
  });
});

describe("planMove — the clock never starts backwards (rule 3)", () => {
  it("refuses a reply or bounce before any initial email is logged", () => {
    const awaiting = co({ status: "NOT_CONTACTED", schedule_status: "AWAITING_INITIAL" });
    expect(planMove(awaiting, "RESPONDED").kind).toBe("refused");
    expect(planMove(awaiting, "BOUNCED").kind).toBe("refused");
  });

  it("still refuses when the status drifted but the schedule is awaiting its first email", () => {
    const odd = co({ status: "INTERESTED", schedule_status: "AWAITING_INITIAL" });
    expect(planMove(odd, "RESPONDED").kind).toBe("refused");
  });
});

describe("planMove — manual flags", () => {
  it("flags Interested with no confirm and an undo (it does not stop the clock)", () => {
    expect(planMove(co({ status: "CONTACTED" }), "INTERESTED")).toEqual({
      kind: "status",
      status: "INTERESTED",
      confirm: null,
      undoable: true,
    });
  });

  it("confirms Declined, because it stops the cadence", () => {
    const move = planMove(co({ status: "CONTACTED", company_name: "Ipca" }), "DECLINED");
    if (move.kind !== "status") throw new Error("expected a status move");
    expect(move.confirm).not.toBeNull();
    expect(move.confirm?.title).toContain("Ipca");
    expect(move.confirm?.description).toMatch(/stops the cadence/i);
    expect(move.undoable).toBe(true);
  });

  it("lets an interested company be marked declined without touching the log", () => {
    expect(planMove(co({ status: "INTERESTED" }), "DECLINED")).toMatchObject({
      kind: "status",
      status: "DECLINED",
    });
  });
});

describe("legalTargets", () => {
  it("offers a fresh company only the initial-email move plus the hand flags", () => {
    const targets = legalTargets(co({ status: "NOT_CONTACTED", schedule_status: "AWAITING_INITIAL" }));
    expect([...targets].sort()).toEqual(["CONTACTED", "DECLINED", "INTERESTED"]);
  });

  it("offers a company in cadence every forward move", () => {
    const targets = legalTargets(co({ status: "CONTACTED" }));
    expect([...targets].sort()).toEqual(["BOUNCED", "DECLINED", "INTERESTED", "RESPONDED"]);
  });

  it("never offers Not contacted to anyone", () => {
    for (const id of COLUMN_IDS) {
      expect(legalTargets(co({ status: id as CompanyStatus })).has("NOT_CONTACTED")).toBe(false);
    }
  });

  it("leaves a replied company only the hand flags", () => {
    expect([...legalTargets(co({ status: "RESPONDED" }))].sort()).toEqual([
      "BOUNCED",
      "DECLINED",
      "INTERESTED",
    ]);
  });
});

describe("buildBoard", () => {
  it("buckets by status and keeps the incoming order", () => {
    const a = co({ status: "CONTACTED", company_name: "A" });
    const b = co({ status: "CONTACTED", company_name: "B" });
    const c = co({ status: "RESPONDED", company_name: "C" });
    const board = buildBoard([a, b, c]);
    expect(board.CONTACTED.map((x) => x.company_name)).toEqual(["A", "B"]);
    expect(board.RESPONDED.map((x) => x.company_name)).toEqual(["C"]);
    expect(board.NOT_CONTACTED).toEqual([]);
  });

  it("always returns all six columns, even when empty", () => {
    expect(Object.keys(buildBoard([])).sort()).toEqual([...COLUMN_IDS].sort());
  });

  it("drops nothing when a status is unexpected", () => {
    const weird = co({ status: "COLD" as CompanyStatus });
    expect(() => buildBoard([weird])).not.toThrow();
  });
});

describe("applyStatusMove (optimistic drop)", () => {
  const a = co({ id: 101, status: "CONTACTED", company_name: "A" });
  const b = co({ id: 102, status: "CONTACTED", company_name: "B" });
  const base = buildBoard([a, b]);

  it("moves the card to the head of the target column and rewrites its status", () => {
    const next = applyStatusMove(base, 101, "INTERESTED");
    expect(next.CONTACTED.map((c) => c.id)).toEqual([102]);
    expect(next.INTERESTED.map((c) => c.id)).toEqual([101]);
    expect(next.INTERESTED[0].status).toBe("INTERESTED");
  });

  it("does not mutate the board it was given (so rollback works)", () => {
    applyStatusMove(base, 101, "DECLINED");
    expect(base.CONTACTED.map((c) => c.id)).toEqual([101, 102]);
    expect(base.DECLINED).toEqual([]);
  });

  it("is a no-op for an unknown card or a same-column move", () => {
    expect(applyStatusMove(base, 999, "DECLINED")).toBe(base);
    expect(applyStatusMove(base, 101, "CONTACTED" as PipelineColumnId)).toBe(base);
  });
});
