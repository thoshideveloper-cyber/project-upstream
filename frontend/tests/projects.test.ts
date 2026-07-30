import { describe, it, expect } from "vitest";
import type { MandateEngagementStats, ProjectHeadline } from "@/types";

/**
 * Unit tests for project list/detail display logic.
 * Pure functions kept in sync with the projects page rendering.
 */

const TYPE_LABELS: Record<string, string> = {
  SELL_SIDE: "Sell-side",
  BUY_SIDE: "Buy-side",
  CAPITAL_RAISE: "Capital raise",
};

function responseRateLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function groupEngagementsByType(
  mandates: MandateEngagementStats[]
): Record<string, MandateEngagementStats[]> {
  return {
    SELL_SIDE: mandates.filter((m) => m.type === "SELL_SIDE"),
    BUY_SIDE: mandates.filter((m) => m.type === "BUY_SIDE"),
    CAPITAL_RAISE: mandates.filter((m) => m.type === "CAPITAL_RAISE"),
  };
}

function computeHeadline(mandates: MandateEngagementStats[]): ProjectHeadline {
  const total_companies = mandates.reduce((s, m) => s + m.total_companies, 0);
  const responded = mandates.reduce((s, m) => s + m.responded, 0);
  const overdue_count = mandates.reduce((s, m) => s + m.overdue_count, 0);
  const cold_count = mandates.reduce((s, m) => s + m.cold_count, 0);
  return {
    total_companies,
    responded,
    response_rate: total_companies > 0 ? responded / total_companies : 0,
    overdue_count,
    cold_count,
  };
}

const MOCK_MANDATES: MandateEngagementStats[] = [
  {
    id: 1,
    name: "Pharma Sell-Side",
    type: "SELL_SIDE",
    status: "ACTIVE",
    client_name: "Medanta Healthcare",
    total_companies: 10,
    responded: 3,
    response_rate: 0.3,
    overdue_count: 2,
    cold_count: 1,
    needs_initial_count: 0,
  },
  {
    id: 2,
    name: "Pharma Buy-Side",
    type: "BUY_SIDE",
    status: "ACTIVE",
    client_name: "Medanta Healthcare",
    total_companies: 5,
    responded: 1,
    response_rate: 0.2,
    overdue_count: 0,
    cold_count: 0,
    needs_initial_count: 2,
  },
];

describe("type labels", () => {
  it("maps all three engagement types", () => {
    expect(TYPE_LABELS.SELL_SIDE).toBe("Sell-side");
    expect(TYPE_LABELS.BUY_SIDE).toBe("Buy-side");
    expect(TYPE_LABELS.CAPITAL_RAISE).toBe("Capital raise");
  });
});

describe("responseRateLabel", () => {
  it("formats zero rate", () => {
    expect(responseRateLabel(0)).toBe("0%");
  });
  it("rounds partial rates", () => {
    expect(responseRateLabel(0.333)).toBe("33%");
    expect(responseRateLabel(0.3)).toBe("30%");
  });
  it("handles 100%", () => {
    expect(responseRateLabel(1)).toBe("100%");
  });
});

describe("groupEngagementsByType", () => {
  it("separates sell-side and buy-side", () => {
    const groups = groupEngagementsByType(MOCK_MANDATES);
    expect(groups.SELL_SIDE).toHaveLength(1);
    expect(groups.SELL_SIDE[0].name).toBe("Pharma Sell-Side");
    expect(groups.BUY_SIDE).toHaveLength(1);
    expect(groups.BUY_SIDE[0].name).toBe("Pharma Buy-Side");
    expect(groups.CAPITAL_RAISE).toHaveLength(0);
  });

  it("handles empty list", () => {
    const groups = groupEngagementsByType([]);
    expect(groups.SELL_SIDE).toHaveLength(0);
    expect(groups.BUY_SIDE).toHaveLength(0);
    expect(groups.CAPITAL_RAISE).toHaveLength(0);
  });
});

describe("computeHeadline", () => {
  it("aggregates total_companies across mandates", () => {
    const h = computeHeadline(MOCK_MANDATES);
    expect(h.total_companies).toBe(15); // 10 + 5
  });

  it("aggregates responded count", () => {
    const h = computeHeadline(MOCK_MANDATES);
    expect(h.responded).toBe(4); // 3 + 1
  });

  it("computes overall response rate", () => {
    const h = computeHeadline(MOCK_MANDATES);
    expect(h.response_rate).toBeCloseTo(4 / 15, 5);
  });

  it("aggregates overdue and cold counts", () => {
    const h = computeHeadline(MOCK_MANDATES);
    expect(h.overdue_count).toBe(2);
    expect(h.cold_count).toBe(1);
  });

  it("returns zero response_rate when no companies", () => {
    const h = computeHeadline([]);
    expect(h.response_rate).toBe(0);
    expect(h.total_companies).toBe(0);
  });
});
