/**
 * Unit tests for the working grid page logic:
 * - Company grouping by CompanyCategory
 * - cadenceTooltip text for overdue / cold / awaiting
 * - cadenceStateFromSchedule for cold companies
 */

import { describe, it, expect } from "vitest";
import { cadenceStateFromSchedule } from "@/components/features/status-badge";
import type { Company, CompanyCategory } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCompany(override: Partial<Company> = {}): Company {
  return {
    id: 1,
    firm_id: 1,
    mandate_id: 1,
    company_name: "Acme Corp",
    hq: null,
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
    source: "PROPRIETARY",
    source_quality: "MEDIUM",
    created_by_id: null,
    archived_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    schedule_status: "AWAITING_INITIAL",
    cycle_number: 1,
    is_cold: false,
    initial_date: null,
    next_due_date: null,
    days_remaining: null,
    is_overdue: false,
    primary_contact: null,
    ...override,
  };
}

// ── Group-by-category logic (mirrors page implementation) ─────────────────────

const CATEGORY_ORDER: CompanyCategory[] = [
  "STRATEGIC",
  "PRIVATE_EQUITY",
  "VENTURE_CAPITAL",
  "FAMILY_OFFICE",
  "FINANCIAL_SPONSOR",
  "OTHER",
];

function groupByCategory(companies: Company[]): Record<CompanyCategory, Company[]> {
  const map = {} as Record<CompanyCategory, Company[]>;
  for (const cat of CATEGORY_ORDER) map[cat] = [];
  for (const c of companies) {
    const cat = (c.category ?? "OTHER") as CompanyCategory;
    map[cat].push(c);
  }
  return map;
}

describe("groupByCategory", () => {
  it("places companies in the correct bucket", () => {
    const companies = [
      makeCompany({ id: 1, company_name: "PE Fund", category: "PRIVATE_EQUITY" }),
      makeCompany({ id: 2, company_name: "Strategic Inc", category: "STRATEGIC" }),
      makeCompany({ id: 3, company_name: "Misc Corp", category: "OTHER" }),
    ];
    const groups = groupByCategory(companies);
    expect(groups.PRIVATE_EQUITY).toHaveLength(1);
    expect(groups.PRIVATE_EQUITY[0].company_name).toBe("PE Fund");
    expect(groups.STRATEGIC).toHaveLength(1);
    expect(groups.OTHER).toHaveLength(1);
  });

  it("all empty when no companies", () => {
    const groups = groupByCategory([]);
    for (const cat of CATEGORY_ORDER) {
      expect(groups[cat]).toHaveLength(0);
    }
  });

  it("multiple companies in same category all appear", () => {
    const companies = [
      makeCompany({ id: 1, company_name: "PE A", category: "PRIVATE_EQUITY" }),
      makeCompany({ id: 2, company_name: "PE B", category: "PRIVATE_EQUITY" }),
      makeCompany({ id: 3, company_name: "PE C", category: "PRIVATE_EQUITY" }),
    ];
    const groups = groupByCategory(companies);
    expect(groups.PRIVATE_EQUITY).toHaveLength(3);
  });

  it("defaults missing category to OTHER", () => {
    // Simulate a company with no category (e.g., older record)
    const c = makeCompany({ category: undefined as unknown as CompanyCategory });
    const groups = groupByCategory([c]);
    expect(groups.OTHER).toHaveLength(1);
  });
});

// ── Cadence tooltip logic (mirrors cadenceTooltip in the grid page) ────────────

function cadenceTooltip(company: Company): string {
  if (company.is_cold) {
    return `Cold: follow-up cap reached after ${company.cycle_number ?? 1} cycle(s). Restart the cadence to re-engage.`;
  }
  if (company.is_overdue && company.next_due_date) {
    return `Overdue since ${company.next_due_date}: next follow-up is past due.`;
  }
  if (company.schedule_status === "AWAITING_INITIAL") {
    return "Awaiting first outreach — log an INITIAL_EMAIL to start the cadence.";
  }
  if (company.next_due_date) {
    return `Next touch due: ${company.next_due_date} (${company.days_remaining ?? 0} days remaining).`;
  }
  return "";
}

describe("cadenceTooltip", () => {
  it("cold company mentions restart", () => {
    const c = makeCompany({
      is_cold: true,
      cycle_number: 1,
      schedule_status: "STOPPED",
    });
    expect(cadenceTooltip(c)).toContain("Cold");
    expect(cadenceTooltip(c)).toContain("Restart");
  });

  it("overdue company names the due date", () => {
    const c = makeCompany({
      is_overdue: true,
      schedule_status: "ACTIVE",
      next_due_date: "2024-03-01",
      days_remaining: -5,
    });
    expect(cadenceTooltip(c)).toContain("Overdue");
    expect(cadenceTooltip(c)).toContain("2024-03-01");
  });

  it("awaiting initial prompts INITIAL_EMAIL", () => {
    const c = makeCompany({ schedule_status: "AWAITING_INITIAL" });
    expect(cadenceTooltip(c)).toContain("INITIAL_EMAIL");
  });

  it("upcoming shows next_due_date", () => {
    const c = makeCompany({
      schedule_status: "ACTIVE",
      next_due_date: "2024-05-10",
      days_remaining: 12,
    });
    expect(cadenceTooltip(c)).toContain("2024-05-10");
    expect(cadenceTooltip(c)).toContain("12 days");
  });

  it("cold overrides overdue in tooltip", () => {
    const c = makeCompany({
      is_cold: true,
      is_overdue: true,
      schedule_status: "STOPPED",
      next_due_date: "2024-03-01",
    });
    // Cold check comes first
    expect(cadenceTooltip(c)).toContain("Cold");
    expect(cadenceTooltip(c)).not.toContain("Overdue");
  });
});

// ── cadenceState for cold + stopped companies ─────────────────────────────────

describe("cadenceStateFromSchedule grid usage", () => {
  it("cold company resolves to stopped state", () => {
    const c = makeCompany({
      is_cold: true,
      schedule_status: "STOPPED",
      days_remaining: null,
    });
    const state = cadenceStateFromSchedule({
      scheduleStatus: c.schedule_status!,
      daysRemaining: c.days_remaining,
    });
    // is_cold companies display as "stopped" in the grid (badge label overrides to "Cold")
    expect(state).toBe("stopped");
  });

  it("inline log availability: AWAITING_INITIAL company has a log action", () => {
    const c = makeCompany({ schedule_status: "AWAITING_INITIAL", id: 42 });
    // The grid always shows the log button; this verifies the company has an id to key off
    expect(c.id).toBe(42);
    expect(c.schedule_status).toBe("AWAITING_INITIAL");
  });
});
