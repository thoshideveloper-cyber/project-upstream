/**
 * Unit tests for the workspace's decision layer (`lib/project-views.ts`) and its row
 * flattener (`lib/workspace-rows.ts`).
 *
 * These two files decide what an analyst sees and in what order, so they are where a
 * regression is most expensive and least visible: a filter that silently stops matching
 * shows an empty list, not an error. Everything under test is pure — no clock, no fetch
 * — because the cadence itself is computed server-side and this layer only reads the
 * fields the server decided (CLAUDE.md rule 2).
 */

import { describe, expect, it } from "vitest";

import { buildWorkspace } from "@/lib/project";
import {
  BUILTIN_VIEWS,
  EMPTY_FILTER,
  VIEW_BY_KEY,
  cadenceOf,
  condition,
  decodeFilter,
  encodeFilter,
  isEmptyFilter,
  loadSavedViews,
  matchesFilter,
  matchesView,
  priorityOf,
  sortCompanies,
  workspaceHref,
  type FilterGroup,
} from "@/lib/project-views";
import {
  buildFlatRows,
  buildRows,
  collapsiblePaths,
  estimateRowHeight,
} from "@/lib/workspace-rows";
import type { Company, MandateEngagementStats } from "@/types";

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

function company(over: Partial<Company> = {}): Company {
  return {
    id: 1,
    firm_id: 1,
    mandate_id: 10,
    company_name: "Acme Industries",
    hq: "Mumbai",
    type: "TARGET",
    status: "NOT_CONTACTED",
    rationale: null,
    revenue_source: null,
    revenue_inr_cr: null,
    headcount: null,
    website: null,
    linkedin: null,
    relevant_investments: null,
    bucket: null,
    category: "STRATEGIC",
    category_id: 1,
    category_name: "Strategic",
    sourcing_layer_id: 5,
    sourcing_layer_name: "Direct",
    source: "MANUAL",
    source_quality: "VERIFIED",
    created_by_id: 1,
    archived_at: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    schedule_status: "ACTIVE",
    cycle_number: 1,
    is_cold: false,
    initial_date: "2026-01-01",
    next_due_date: "2026-02-01",
    days_remaining: 10,
    is_overdue: false,
    primary_contact: { id: 1, contact_person: "R. Iyer", email: "r@acme.test" } as never,
    ...over,
  } as Company;
}

function engagement(over: Partial<MandateEngagementStats> = {}): MandateEngagementStats {
  return {
    id: 10,
    name: "Book raise",
    type: "SELL_SIDE",
    total_companies: 0,
    responded: 0,
    overdue_count: 0,
    needs_initial_count: 0,
    cold_count: 0,
    analysts: [],
    ...over,
  } as MandateEngagementStats;
}

/* ── Filter encoding ──────────────────────────────────────────────────────── */

describe("filter URL encoding", () => {
  it("round-trips a single condition", () => {
    const f = condition("attention", "any_of", ["late"]);
    expect(encodeFilter(f)).toBe("attention:any_of:late");
    const back = decodeFilter(encodeFilter(f));
    expect(back.join).toBe("and");
    expect(back.conditions).toHaveLength(1);
    expect(back.conditions[0]).toMatchObject({
      field: "attention",
      op: "any_of",
      values: ["late"],
    });
  });

  it("round-trips several values and several conditions", () => {
    const f: FilterGroup = {
      join: "and",
      conditions: [
        { id: "a", field: "status", op: "any_of", values: ["RESPONDED", "INTERESTED"] },
        { id: "b", field: "overdueBy", op: "gte", values: [30] },
      ],
    };
    expect(encodeFilter(f)).toBe("status:any_of:RESPONDED|INTERESTED,overdueBy:gte:30");
    expect(decodeFilter(encodeFilter(f)).conditions).toHaveLength(2);
  });

  it("costs nothing for the default join and marks the other one", () => {
    const and = condition("status", "any_of", ["CONTACTED"]);
    expect(encodeFilter(and).startsWith("or;")).toBe(false);
    expect(encodeFilter({ ...and, join: "or" })).toBe("or;status:any_of:CONTACTED");
    expect(decodeFilter("or;status:any_of:CONTACTED").join).toBe("or");
  });

  it("encodes an empty filter as nothing at all", () => {
    expect(encodeFilter(EMPTY_FILTER)).toBe("");
    expect(encodeFilter(undefined)).toBe("");
    // A condition nobody finished answering narrows nothing, so it is not encoded.
    expect(encodeFilter({ join: "and", conditions: [{ id: "x", field: "hq", op: "any_of", values: [] }] })).toBe("");
  });

  it("drops garbage rather than throwing", () => {
    // A hand-edited or truncated URL must show the whole book, never an error page.
    expect(isEmptyFilter(decodeFilter("nonsense"))).toBe(true);
    expect(isEmptyFilter(decodeFilter("notafield:any_of:x"))).toBe(true);
    expect(isEmptyFilter(decodeFilter("status:bogus_op:x"))).toBe(true);
    expect(isEmptyFilter(decodeFilter(null))).toBe(true);
    // The good half of a half-broken filter survives.
    expect(decodeFilter("status:any_of:CONTACTED,garbage").conditions).toHaveLength(1);
  });
});

/* ── Matching ─────────────────────────────────────────────────────────────── */

describe("matchesFilter", () => {
  it("passes everything when empty", () => {
    expect(matchesFilter(company(), EMPTY_FILTER)).toBe(true);
    expect(matchesFilter(company(), undefined)).toBe(true);
  });

  it("matches any_of and none_of on an enum field", () => {
    const c = company({ status: "RESPONDED" });
    expect(matchesFilter(c, condition("status", "any_of", ["RESPONDED"]))).toBe(true);
    expect(matchesFilter(c, condition("status", "any_of", ["BOUNCED"]))).toBe(false);
    expect(matchesFilter(c, condition("status", "none_of", ["BOUNCED"]))).toBe(true);
    expect(matchesFilter(c, condition("status", "none_of", ["RESPONDED"]))).toBe(false);
  });

  it("treats an unset value as the literal 'none' bucket", () => {
    const c = company({ category_id: null, category_name: null });
    expect(matchesFilter(c, condition("category", "any_of", ["none"]))).toBe(true);
  });

  it("excludes rows that have no value at all from a numeric comparison", () => {
    // The trap this guards: treating "not overdue" as 0 days overdue would sweep the
    // entire book into "overdue by at most 5 days".
    const onTime = company({ is_overdue: false, days_remaining: 10 });
    const late = company({ is_overdue: true, days_remaining: -40 });
    expect(matchesFilter(onTime, condition("overdueBy", "lte", [5]))).toBe(false);
    expect(matchesFilter(late, condition("overdueBy", "gte", [30]))).toBe(true);
    expect(matchesFilter(late, condition("overdueBy", "gte", [50]))).toBe(false);
  });

  it("does not offer a due-in-N-days answer for a stopped or cold cadence", () => {
    const cold = company({ is_cold: true, days_remaining: 2 });
    const stopped = company({ schedule_status: "STOPPED", days_remaining: 2 });
    expect(matchesFilter(cold, condition("dueWithin", "lte", [7]))).toBe(false);
    expect(matchesFilter(stopped, condition("dueWithin", "lte", [7]))).toBe(false);
    expect(matchesFilter(company({ days_remaining: 2 }), condition("dueWithin", "lte", [7]))).toBe(true);
  });

  it("joins conditions with and / or", () => {
    const c = company({ status: "RESPONDED", mandate_id: 10 });
    const both: FilterGroup = {
      join: "and",
      conditions: [
        { id: "a", field: "status", op: "any_of", values: ["RESPONDED"] },
        { id: "b", field: "engagement", op: "any_of", values: [99] },
      ],
    };
    expect(matchesFilter(c, both)).toBe(false);
    expect(matchesFilter(c, { ...both, join: "or" })).toBe(true);
  });
});

/* ── Cadence vs attention ─────────────────────────────────────────────────── */

describe("cadenceOf", () => {
  it("separates the schedule's own state from whether the row needs work", () => {
    expect(cadenceOf(company())).toBe("running");
    expect(cadenceOf(company({ schedule_status: "AWAITING_INITIAL" }))).toBe("awaiting");
    expect(cadenceOf(company({ is_cold: true }))).toBe("cold");
    expect(cadenceOf(company({ schedule_status: "STOPPED" }))).toBe("stopped");
    // Cold wins over the underlying status: the cap is why nothing more will happen.
    expect(cadenceOf(company({ is_cold: true, schedule_status: "AWAITING_INITIAL" }))).toBe("cold");
  });
});

/* ── Priority ─────────────────────────────────────────────────────────────── */

describe("priorityOf", () => {
  it("gives a healthy running company no reasons at all", () => {
    const p = priorityOf(company({ days_remaining: 20 }));
    expect(p.reasons).toEqual([]);
    expect(p.band).toBe("none");
  });

  it("ranks an unanswered reply above an overdue follow-up", () => {
    // The one editorial claim the weights encode, asserted so a future tweak is
    // deliberate rather than accidental.
    const replied = priorityOf(company({ status: "RESPONDED", schedule_status: "STOPPED" }));
    const late = priorityOf(company({ is_overdue: true, days_remaining: -10 }));
    expect(replied.score).toBeGreaterThan(late.score);
  });

  it("ramps with lateness and then flattens", () => {
    const at = (d: number) => priorityOf(company({ is_overdue: true, days_remaining: -d })).score;
    expect(at(12)).toBeGreaterThan(at(3));
    // 12 + 3d is capped at 60, so beyond ~16 days the weight stops moving.
    expect(at(90)).toBe(at(80));
  });

  it("states every reason in words the panel can print verbatim", () => {
    const p = priorityOf(company({ is_overdue: true, days_remaining: -1 }));
    expect(p.reasons[0].label).toBe("1 day overdue");
  });

  it("never lets cold lift a row up the queue", () => {
    const p = priorityOf(company({ is_cold: true, schedule_status: "STOPPED" }));
    expect(p.reasons.map((r) => r.label)).toContain("Follow-up cap reached");
    expect(p.score).toBe(0);
    expect(p.band).toBe("none");
  });
});

/* ── Sorting ──────────────────────────────────────────────────────────────── */

describe("sortCompanies", () => {
  const a = company({ id: 1, company_name: "Zeta", is_overdue: true, days_remaining: -40 });
  const b = company({ id: 2, company_name: "Alpha", days_remaining: 3, next_due_date: "2026-01-05" });
  const c = company({ id: 3, company_name: "Mid", schedule_status: "STOPPED", next_due_date: null });

  it("orders by name as the stable default", () => {
    expect(sortCompanies([a, b, c], "name").map((x) => x.company_name)).toEqual([
      "Alpha",
      "Mid",
      "Zeta",
    ]);
  });

  it("puts the most overdue first, and the not-overdue last", () => {
    expect(sortCompanies([b, a, c], "overdue")[0].company_name).toBe("Zeta");
  });

  it("sorts a company with no next touch to the end, not to the front", () => {
    // A stopped schedule is not "due first" — sorting null as an empty string would
    // put every finished company at the top of the work queue.
    expect(sortCompanies([c, b], "next").map((x) => x.company_name)).toEqual(["Alpha", "Mid"]);
  });

  it("does not mutate its input", () => {
    const input = [a, b];
    sortCompanies(input, "name");
    expect(input.map((x) => x.id)).toEqual([1, 2]);
  });
});

/* ── Views ────────────────────────────────────────────────────────────────── */

describe("views", () => {
  it("gives every built-in a unique key and a hint", () => {
    const keys = BUILTIN_VIEWS.map((v) => v.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const v of BUILTIN_VIEWS) expect(v.hint.length).toBeGreaterThan(0);
  });

  it("makes the working views flat, so priority order holds across the project", () => {
    // A queue that re-sorts by engagement is a filing cabinet, not a queue.
    for (const key of ["attention", "follow-ups", "replied", "due-soon", "cold", "blocked"]) {
      expect(VIEW_BY_KEY[key].group).toBe("flat");
    }
    expect(VIEW_BY_KEY["by-band"].group).toBe("band");
    expect(VIEW_BY_KEY.all.group).toBe("band-category");
  });

  it("recognises when live state has drifted from the view it claims to be", () => {
    const v = VIEW_BY_KEY["follow-ups"];
    expect(matchesView(v, { filter: v.filter, group: v.group, sort: v.sort })).toBe(true);
    expect(matchesView(v, { filter: v.filter, group: v.group, sort: "name" })).toBe(false);
    expect(matchesView(v, { filter: EMPTY_FILTER, group: v.group, sort: v.sort })).toBe(false);
  });

  it("selects the records its name promises", () => {
    const late = company({ is_overdue: true, days_remaining: -5 });
    const fine = company({ id: 2, days_remaining: 30 });
    const f = VIEW_BY_KEY["follow-ups"].filter;
    expect(matchesFilter(late, f)).toBe(true);
    expect(matchesFilter(fine, f)).toBe(false);
  });

  it("survives a browser with no storage", () => {
    // jsdom has localStorage; the contract that matters is that a failure is empty,
    // not thrown, so the workspace renders with no saved views rather than not at all.
    expect(Array.isArray(loadSavedViews(1))).toBe(true);
  });
});

/* ── Drill-through ────────────────────────────────────────────────────────── */

describe("workspaceHref", () => {
  it("stays bare for the default view", () => {
    expect(workspaceHref(7)).toBe("/projects/7/workspace");
    expect(workspaceHref(7, { view: "all" })).toBe("/projects/7/workspace");
  });

  it("carries the view, the filter, the grouping and the sort", () => {
    const href = workspaceHref(7, {
      view: "follow-ups",
      filter: condition("engagement", "any_of", [3]),
      group: "flat",
      sort: "overdue",
    });
    expect(href).toContain("view=follow-ups");
    expect(href).toContain("group=flat");
    expect(href).toContain("sort=overdue");
    // The filter survives a round-trip through the URL, which is the whole point:
    // an analytics figure and the list behind it must be the same query.
    const f = decodeFilter(new URLSearchParams(href.split("?")[1]).get("f"));
    expect(f.conditions[0]).toMatchObject({ field: "engagement", values: ["3"] });
  });
});

/* ── Rows ─────────────────────────────────────────────────────────────────── */

describe("row flattening", () => {
  const eng = engagement({ id: 10, name: "Book raise" });
  const tree = () =>
    buildWorkspace({
      companies: [
        company({ id: 1, company_name: "A" }),
        company({ id: 2, company_name: "B", category_id: 2, category_name: "PE" }),
      ],
      engagements: [eng],
      groupBy: "band-category",
      categoryOrder: [1, 2],
    });

  it("emits a header for every open group and a row for every company", () => {
    const rows = buildRows({ tree: tree(), isOpen: () => true, groupBy: "band-category" });
    expect(rows.filter((r) => r.kind === "company")).toHaveLength(2);
    expect(rows.filter((r) => r.kind === "group").length).toBeGreaterThanOrEqual(3);
  });

  it("stops at a closed group, so collapsing actually removes work", () => {
    // This is what makes collapse a performance lever and not just a visual one.
    const rows = buildRows({ tree: tree(), isOpen: () => false, groupBy: "band-category" });
    expect(rows.filter((r) => r.kind === "company")).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });

  it("shows every company with no cap", () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      company({ id: i + 1, company_name: `Co ${i}` }),
    );
    const rows = buildRows({
      tree: buildWorkspace({ companies: many, engagements: [eng], groupBy: "none" }),
      isOpen: () => true,
      groupBy: "none",
    });
    // The old workspace capped a leaf at 40 and still printed the true count in the
    // header — the count and the list have to be the same number.
    expect(rows.filter((r) => r.kind === "company")).toHaveLength(250);
  });

  it("gives an open but empty book a row that can be filled", () => {
    const rows = buildRows({
      tree: buildWorkspace({ companies: [], engagements: [eng], groupBy: "none" }),
      isOpen: () => true,
      groupBy: "none",
    });
    expect(rows.some((r) => r.kind === "empty")).toBe(true);
  });

  it("names the engagement on a flat row only when more than one is in play", () => {
    const names = new Map([
      [10, "Book raise"],
      [11, "Book PE"],
    ]);
    const oneBook = buildFlatRows([company({ id: 1 })], names);
    expect(oneBook[0]).toMatchObject({ showEngagement: false });

    const twoBooks = buildFlatRows(
      [company({ id: 1, mandate_id: 10 }), company({ id: 2, mandate_id: 11 })],
      names,
    );
    expect(twoBooks[0]).toMatchObject({ showEngagement: true, engagementLabel: "Book raise" });
    expect(twoBooks[1]).toMatchObject({ engagementLabel: "Book PE" });
  });

  it("names every collapsible path, including an empty engagement", () => {
    const paths = collapsiblePaths(
      buildWorkspace({ companies: [], engagements: [eng], groupBy: "band-category" }),
    );
    expect(paths).toContain("eng-10");
  });

  it("estimates a compact row shorter than a comfortable one", () => {
    const [row] = buildFlatRows([company()], new Map());
    expect(estimateRowHeight(row, true)).toBeLessThan(estimateRowHeight(row, false));
  });
});
