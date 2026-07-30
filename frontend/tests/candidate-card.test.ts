import { describe, it, expect } from "vitest";
import { scoreTone, revLabel } from "@/components/features/candidate-card";
import { buildPoolQS } from "@/hooks/use-candidates";

describe("scoreTone", () => {
  it("bands by score", () => {
    expect(scoreTone(null)).toContain("muted");
    expect(scoreTone(90)).toContain("emerald");
    expect(scoreTone(65)).toContain("lime");
    expect(scoreTone(45)).toContain("amber");
    expect(scoreTone(25)).toContain("orange");
    expect(scoreTone(5)).toContain("red");
  });
});

describe("revLabel", () => {
  it("formats INR crores", () => {
    expect(revLabel(null)).toBe("—");
    expect(revLabel("850.5")).toContain("₹");
    expect(revLabel("850.5")).toContain("Cr");
  });
});

describe("buildPoolQS", () => {
  it("always includes mandate_id and omits empty filters", () => {
    const qs = buildPoolQS({ mandate_id: 5, q: "acme", sort: "score" });
    expect(qs).toContain("mandate_id=5");
    expect(qs).toContain("q=acme");
    expect(qs).toContain("sort=score");
    expect(qs).not.toContain("hq=");
  });

  it("serializes has_score only when true", () => {
    expect(buildPoolQS({ mandate_id: 1, has_score: true })).toContain("has_score=true");
    expect(buildPoolQS({ mandate_id: 1, has_score: false })).not.toContain("has_score");
  });

  it("serializes the Discover criteria (rev_band, warm_only)", () => {
    const qs = buildPoolQS({ mandate_id: 1, rev_band: "b100_500", warm_only: true });
    expect(qs).toContain("rev_band=b100_500");
    expect(qs).toContain("warm_only=true");
    const bare = buildPoolQS({ mandate_id: 1 });
    expect(bare).not.toContain("rev_band");
    expect(bare).not.toContain("warm_only");
  });
});
