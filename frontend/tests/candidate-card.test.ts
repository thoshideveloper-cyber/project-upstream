import { describe, it, expect } from "vitest";
import { scoreTone, revLabel } from "@/components/features/candidate-card";
import { buildPoolQS, UNCLASSIFIED_SECTOR } from "@/hooks/use-candidates";

describe("scoreTone", () => {
  // The product is ink on paper: a fit score is banded by ink density, darkest for the
  // strongest fit, and never by hue.
  it("bands by score down the ink ladder", () => {
    expect(scoreTone(null)).toContain("muted");
    expect(scoreTone(90)).toContain("ink-900");
    expect(scoreTone(65)).toContain("ink-700");
    expect(scoreTone(45)).toContain("ink-200");
    expect(scoreTone(25)).toContain("ink-100");
    expect(scoreTone(5)).toContain("ring-border");
  });

  it("keeps paper-white type on the two dark bands", () => {
    expect(scoreTone(90)).toContain("text-background");
    expect(scoreTone(65)).toContain("text-background");
    expect(scoreTone(45)).toContain("text-foreground");
  });

  it("never reaches for a hue", () => {
    for (const s of [null, 0, 5, 25, 45, 65, 90, 100]) {
      expect(scoreTone(s)).not.toMatch(/emerald|amber|sky|violet|indigo|red|green/);
    }
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

  it("serializes the profile-level criteria (segment, sector)", () => {
    const qs = buildPoolQS({ segment: "INVESTOR", sector: "Private equity" });
    expect(qs).toContain("segment=INVESTOR");
    expect(qs).toContain("sector=Private+equity");
    // Both narrow the database itself, so neither needs a mandate to be meaningful.
    expect(qs).not.toContain("mandate_id");
  });

  it("passes the unclassified-sector sentinel through unchanged", () => {
    expect(buildPoolQS({ sector: UNCLASSIFIED_SECTOR })).toContain(
      `sector=${encodeURIComponent(UNCLASSIFIED_SECTOR)}`,
    );
  });
});
