/**
 * Unit tests for the project workspace's derivations (`lib/project.ts`).
 *
 * These are the functions the header, the overview, the workspace tree and the analytics
 * page all read, so a disagreement between two panels of the redesigned project would
 * show up here first. Everything under test is pure — no clock, no fetch — because the
 * cadence itself is computed server-side and this file only counts what the server said.
 */

import { describe, expect, it } from "vitest";

import {
  attentionOf,
  attentionQueue,
  bucketTasksByDue,
  buildWorkspace,
  filterCompanies,
  flattenNodes,
  progressSteps,
  vitalsOf,
} from "@/lib/project";
import type { Company, MandateEngagementStats, Task } from "@/types";

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
    category: "OTHER",
    category_id: null,
    category_name: null,
    sourcing_layer_id: null,
    sourcing_layer_name: null,
    source: "PROPRIETARY",
    source_quality: "MEDIUM",
    created_by_id: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    schedule_status: "ACTIVE",
    cycle_number: 1,
    is_cold: false,
    initial_date: "2026-01-01",
    next_due_date: "2026-01-08",
    days_remaining: 3,
    is_overdue: false,
    primary_contact: {
      id: 1,
      contact_person: "R. Kapoor",
      email: "r@acme.test",
    } as Company["primary_contact"],
    ...over,
  };
}

function engagement(over: Partial<MandateEngagementStats> = {}): MandateEngagementStats {
  return {
    id: 10,
    name: "Pharma sell-side",
    type: "SELL_SIDE",
    status: "ACTIVE",
    client_name: "Medanta",
    total_companies: 0,
    responded: 0,
    response_rate: 0,
    overdue_count: 0,
    cold_count: 0,
    needs_initial_count: 0,
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 1,
    firm_id: 1,
    scope: "PROJECT",
    project_id: 5,
    mandate_id: null,
    company_id: null,
    contact_id: null,
    title: "Chase the NDA",
    notes: null,
    status: "BACKLOG",
    priority: "MEDIUM",
    due_date: null,
    assignee_id: null,
    created_by_id: null,
    completed_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    assignee_name: null,
    created_by_name: null,
    project_name: "Medanta",
    attached_to: null,
    is_overdue: false,
    ...over,
  };
}

/* ── Attention ────────────────────────────────────────────────────────────── */

describe("attentionOf", () => {
  it("ranks late above everything else it could also be", () => {
    // Overdue AND contactless: the row is late, and that is the word that goes on it.
    expect(attentionOf(company({ is_overdue: true, primary_contact: null }))).toBe("late");
  });

  it("calls an unstarted schedule 'awaiting', not late", () => {
    expect(
      attentionOf(company({ schedule_status: "AWAITING_INITIAL", is_overdue: false })),
    ).toBe("awaiting");
  });

  it("flags a company with nobody to email", () => {
    expect(attentionOf(company({ primary_contact: null }))).toBe("no-contact");
  });

  it("does not treat cold as attention — the cadence finished, it did not stall", () => {
    // Cold wins even over overdue: an exhausted cadence has no next touch to be late for.
    expect(attentionOf(company({ is_cold: true, is_overdue: true }))).toBe("none");
  });

  it("leaves a stopped, contactless company alone", () => {
    // The cadence is deliberately over (replied / declined) — a missing contact is not
    // a backlog item on a company nobody is going to email again.
    expect(
      attentionOf(company({ schedule_status: "STOPPED", primary_contact: null })),
    ).toBe("none");
  });
});

describe("attentionQueue", () => {
  it("puts the longest-late row first, then awaiting, then contactless", () => {
    const queue = attentionQueue([
      company({ id: 1, company_name: "Contactless", primary_contact: null }),
      company({ id: 2, company_name: "Slightly late", is_overdue: true, days_remaining: -2 }),
      company({ id: 3, company_name: "Never introduced", schedule_status: "AWAITING_INITIAL" }),
      company({ id: 4, company_name: "Very late", is_overdue: true, days_remaining: -40 }),
      company({ id: 5, company_name: "Fine" }),
    ]);

    expect(queue.map((q) => q.company.company_name)).toEqual([
      "Very late",
      "Slightly late",
      "Never introduced",
      "Contactless",
    ]);
  });

  it("honours the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      company({ id: i + 1, is_overdue: true, days_remaining: -i }),
    );
    expect(attentionQueue(many, 5)).toHaveLength(5);
  });
});

/* ── Vitals ───────────────────────────────────────────────────────────────── */

describe("vitalsOf", () => {
  it("counts every state exactly once, so the health bar's segments sum to the total", () => {
    const v = vitalsOf([
      company({ id: 1, status: "NOT_CONTACTED", schedule_status: "AWAITING_INITIAL" }),
      company({ id: 2, status: "CONTACTED", is_overdue: true }),
      company({ id: 3, status: "RESPONDED" }),
      company({ id: 4, status: "DECLINED" }),
      company({ id: 5, status: "CONTACTED", is_cold: true }),
      company({ id: 6, status: "CONTACTED" }),
    ]);

    expect(v.total).toBe(6);
    expect(v.awaiting).toBe(1);
    expect(v.late).toBe(1);
    expect(v.cold).toBe(1);
    // RESPONDED + DECLINED both count as replied — any answer is an answer.
    expect(v.replied).toBe(2);
    // The remainder the bar draws must never be negative.
    expect(v.total - v.late - v.awaiting - v.replied - v.cold).toBeGreaterThanOrEqual(0);
  });

  it("rates replies against contacted, not against the whole book", () => {
    const v = vitalsOf([
      company({ id: 1, status: "NOT_CONTACTED" }),
      company({ id: 2, status: "NOT_CONTACTED" }),
      company({ id: 3, status: "CONTACTED" }),
      company({ id: 4, status: "RESPONDED" }),
    ]);
    expect(v.contacted).toBe(2);
    expect(v.replyRate).toBe(0.5);
  });

  it("reports a zero rate rather than NaN when nobody has been contacted", () => {
    expect(vitalsOf([company({ status: "NOT_CONTACTED" })]).replyRate).toBe(0);
    expect(vitalsOf([]).replyRate).toBe(0);
  });
});

/* ── The tree ─────────────────────────────────────────────────────────────── */

describe("buildWorkspace", () => {
  const engagements = [
    engagement({ id: 10, name: "Sell-side" }),
    engagement({ id: 20, name: "Buy-side", type: "BUY_SIDE" }),
  ];

  const companies = [
    company({ id: 1, mandate_id: 10, sourcing_layer_id: 1, sourcing_layer_name: "Tier 1", category_id: 7, category_name: "Strategic" }),
    company({ id: 2, mandate_id: 10, sourcing_layer_id: 1, sourcing_layer_name: "Tier 1", category_id: 8, category_name: "Private Equity" }),
    company({ id: 3, mandate_id: 10, sourcing_layer_id: 2, sourcing_layer_name: "Tier 2", category_id: 7, category_name: "Strategic" }),
    company({ id: 4, mandate_id: 20, is_overdue: true, days_remaining: -5 }),
  ];

  it("nests engagement → band → category and keeps every company", () => {
    const tree = buildWorkspace({ companies, engagements, groupBy: "band-category" });

    expect(tree).toHaveLength(2);
    const sell = tree[0];
    expect(sell.level).toBe("engagement");
    expect(sell.children.map((b) => b.label)).toEqual(["Tier 1", "Tier 2"]);
    expect(sell.children[0].children.map((c) => c.label)).toContain("Strategic");

    // Nothing is lost or duplicated on the way down.
    const leafCompanies = flattenNodes(tree)
      .filter((n) => n.children.length === 0)
      .flatMap((n) => n.companies.map((c) => c.id))
      .sort();
    expect(leafCompanies).toEqual([1, 2, 3, 4]);
  });

  it("rolls a branch's vitals up from its descendants", () => {
    const tree = buildWorkspace({ companies, engagements, groupBy: "band-category" });
    expect(tree[0].vitals.total).toBe(3);
    expect(tree[1].vitals.total).toBe(1);
    expect(tree[1].vitals.late).toBe(1);
    expect(tree[1].attention).toBe("late");
  });

  it("respects the firm's own band order over the alphabet", () => {
    const withOrder = buildWorkspace({
      companies,
      engagements,
      groupBy: "band",
      // The firm put Tier 2 first; the tree must not "fix" that.
      layerOrderByMandate: { 10: [2, 1] },
    });
    expect(withOrder[0].children.map((b) => b.label)).toEqual(["Tier 2", "Tier 1"]);
  });

  it("puts the unsorted bucket last whatever the order says", () => {
    const tree = buildWorkspace({
      companies: [
        ...companies,
        company({ id: 5, mandate_id: 10, sourcing_layer_id: null }),
      ],
      engagements,
      groupBy: "band",
      layerOrderByMandate: { 10: [1, 2] },
    });
    expect(tree[0].children.at(-1)!.label).toBe("Unsorted");
  });

  it("keeps an empty engagement visible — a book you cannot see looks deleted", () => {
    const tree = buildWorkspace({
      companies: companies.filter((c) => c.mandate_id === 10),
      engagements,
      groupBy: "band-category",
    });
    expect(tree).toHaveLength(2);
    expect(tree[1].vitals.total).toBe(0);
    expect(tree[1].children).toHaveLength(0);
  });

  it("gives every node a path that is stable and unique", () => {
    const tree = buildWorkspace({ companies, engagements, groupBy: "band-category" });
    const paths = flattenNodes(tree).map((n) => n.path);
    expect(new Set(paths).size).toBe(paths.length);

    // Rebuilding from the same input must produce the same keys, or expand/collapse
    // state would reset on every refetch.
    const again = buildWorkspace({ companies, engagements, groupBy: "band-category" });
    expect(flattenNodes(again).map((n) => n.path)).toEqual(paths);
  });

  it("flattens to companies directly under the engagement when grouping is off", () => {
    const tree = buildWorkspace({ companies, engagements, groupBy: "none" });
    expect(tree[0].children).toHaveLength(0);
    expect(tree[0].companies).toHaveLength(3);
  });
});

/* ── Filtering ────────────────────────────────────────────────────────────── */

describe("filterCompanies", () => {
  const rows = [
    company({ id: 1, company_name: "Acme", hq: "Mumbai" }),
    company({
      id: 2,
      company_name: "Borealis",
      hq: "Delhi",
      primary_contact: { id: 9, contact_person: "S. Rao", email: "s@bor.test" } as Company["primary_contact"],
    }),
    // Explicit HQ and contact: the shared fixture's defaults (Mumbai, r@acme.test)
    // would otherwise make this row match both of the searches below by accident.
    company({
      id: 3,
      company_name: "Cygnet",
      hq: "Pune",
      mandate_id: 20,
      is_overdue: true,
      primary_contact: {
        id: 11,
        contact_person: "T. Iyer",
        email: "t@cygnet.test",
      } as Company["primary_contact"],
    }),
  ];

  it("searches the record the way a person reads it — name, HQ, contact", () => {
    expect(filterCompanies(rows, { q: "mumbai" }).map((c) => c.id)).toEqual([1]);
    expect(filterCompanies(rows, { q: "s. rao" }).map((c) => c.id)).toEqual([2]);
    expect(filterCompanies(rows, { q: "cyg" }).map((c) => c.id)).toEqual([3]);
  });

  it("scopes to one engagement", () => {
    expect(filterCompanies(rows, { mandateId: 20 }).map((c) => c.id)).toEqual([3]);
  });

  it("combines filters rather than replacing them", () => {
    expect(filterCompanies(rows, { mandateId: 20, q: "acme" })).toHaveLength(0);
  });
});

/* ── Progression ──────────────────────────────────────────────────────────── */

describe("progressSteps", () => {
  it("measures each step against the one before it, not against the total", () => {
    const steps = progressSteps([
      company({ id: 1, status: "NOT_CONTACTED" }),
      company({ id: 2, status: "CONTACTED" }),
      company({ id: 3, status: "CONTACTED" }),
      company({ id: 4, status: "RESPONDED" }),
      company({ id: 5, status: "INTERESTED" }),
    ]);

    const by = Object.fromEntries(steps.map((s) => [s.key, s]));
    expect(by.sourced.value).toBe(5);
    expect(by.contacted.value).toBe(4);
    expect(by.replied.value).toBe(2);
    expect(by.interested.value).toBe(1);
    // replied / contacted, not replied / sourced.
    expect(by.replied.ofPrevious).toBe(0.5);
    expect(by.interested.ofPrevious).toBe(0.5);
  });

  it("never divides by zero on an empty book", () => {
    for (const s of progressSteps([])) {
      expect(Number.isFinite(s.ofPrevious)).toBe(true);
    }
  });
});

/* ── Work buckets ─────────────────────────────────────────────────────────── */

describe("bucketTasksByDue", () => {
  const today = "2026-03-10";

  it("trusts the server's is_overdue rather than comparing dates itself", () => {
    // The date says tomorrow, the server says overdue (it computes against IST). The
    // server wins — that is the whole rule.
    const buckets = bucketTasksByDue(
      [task({ id: 1, due_date: "2026-03-11", is_overdue: true })],
      today,
    );
    expect(buckets[0].key).toBe("overdue");
  });

  it("separates today, this week, later and undated", () => {
    const buckets = bucketTasksByDue(
      [
        task({ id: 1, due_date: today }),
        task({ id: 2, due_date: "2026-03-14" }),
        task({ id: 3, due_date: "2026-06-01" }),
        task({ id: 4, due_date: null }),
      ],
      today,
    );
    expect(buckets.map((b) => b.key)).toEqual(["today", "week", "later", "none"]);
  });

  it("drops finished work — a project's work list is not an archive", () => {
    expect(
      bucketTasksByDue([task({ id: 1, status: "DONE", due_date: today })], today),
    ).toEqual([]);
  });

  it("omits empty buckets rather than rendering empty headings", () => {
    const buckets = bucketTasksByDue([task({ id: 1, due_date: null })], today);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe("none");
  });
});
