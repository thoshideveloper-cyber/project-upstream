import { describe, it, expect } from "vitest";
import { cadenceStateFromSchedule } from "@/components/features/status-badge";
import type { Company } from "@/types";

/**
 * Unit tests for the cadence-state mapping logic used on the companies list.
 * These run fast with no network and verify the client mapping stays correct.
 */

function makeCompany(
  override: Partial<Company> = {},
): Company {
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

describe("cadenceStateFromSchedule on company fields", () => {
  it("AWAITING_INITIAL → needs_initial", () => {
    const c = makeCompany({ schedule_status: "AWAITING_INITIAL" });
    expect(
      cadenceStateFromSchedule({ scheduleStatus: c.schedule_status!, daysRemaining: c.days_remaining }),
    ).toBe("needs_initial");
  });

  it("STOPPED → stopped", () => {
    const c = makeCompany({ schedule_status: "STOPPED" });
    expect(
      cadenceStateFromSchedule({ scheduleStatus: c.schedule_status!, daysRemaining: null }),
    ).toBe("stopped");
  });

  it("ACTIVE overdue → overdue", () => {
    const c = makeCompany({ schedule_status: "ACTIVE", days_remaining: -3, is_overdue: true });
    expect(
      cadenceStateFromSchedule({ scheduleStatus: c.schedule_status!, daysRemaining: c.days_remaining }),
    ).toBe("overdue");
  });

  it("ACTIVE due_soon → due_soon", () => {
    const c = makeCompany({ schedule_status: "ACTIVE", days_remaining: 5 });
    expect(
      cadenceStateFromSchedule({ scheduleStatus: c.schedule_status!, daysRemaining: c.days_remaining }),
    ).toBe("due_soon");
  });

  it("ACTIVE well ahead → upcoming", () => {
    const c = makeCompany({ schedule_status: "ACTIVE", days_remaining: 20 });
    expect(
      cadenceStateFromSchedule({ scheduleStatus: c.schedule_status!, daysRemaining: c.days_remaining }),
    ).toBe("upcoming");
  });
});
