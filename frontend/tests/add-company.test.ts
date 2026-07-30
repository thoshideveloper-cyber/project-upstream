import { describe, it, expect } from "vitest";
import { suggestRevenueInrCr } from "@/components/features/add-company";

/**
 * Unit tests for the exchange-rate revenue conversion used in the add-company form.
 * ₹Cr = millions(source currency) × rate ÷ 10  (1 crore = 10 million).
 */
describe("suggestRevenueInrCr", () => {
  it("converts $70m at 83.6 → ~585 Cr (plan example)", () => {
    expect(suggestRevenueInrCr("$70m", 83.6)).toBeCloseTo(585.2, 1);
  });

  it("treats a bare number as millions", () => {
    expect(suggestRevenueInrCr("100", 80)).toBeCloseTo(800, 1); // 100m × 80 / 10
  });

  it("handles billions", () => {
    expect(suggestRevenueInrCr("2bn", 80)).toBeCloseTo(16000, 1); // 2000m × 80 / 10
  });

  it("returns null without a rate", () => {
    expect(suggestRevenueInrCr("$70m", null)).toBeNull();
    expect(suggestRevenueInrCr("$70m", 0)).toBeNull();
  });

  it("returns null when it can't parse a number", () => {
    expect(suggestRevenueInrCr("n/a", 83)).toBeNull();
    expect(suggestRevenueInrCr("", 83)).toBeNull();
    expect(suggestRevenueInrCr(null, 83)).toBeNull();
  });
});
