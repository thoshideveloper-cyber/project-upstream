import { describe, it, expect } from "vitest";

import {
  filterGroups,
  flattenGroups,
  itemMatches,
  matches,
  moveIndex,
  type PaletteGroup,
  type PaletteItem,
} from "@/lib/command-palette";

/**
 * Unit tests for the command-palette matching + keyboard-index helpers.
 * The rendered component wires these; the logic lives here so it's testable
 * without a QueryClient / router.
 */

const item = (id: string, label: string, extra: Partial<PaletteItem> = {}): PaletteItem => ({
  id,
  kind: "company",
  label,
  ...extra,
});

const groups = (): PaletteGroup[] => [
  {
    heading: "Quick actions",
    items: [item("a1", "New company", { kind: "action", keywords: "create add" })],
  },
  {
    heading: "Companies",
    items: [
      item("c1", "Tata Steel", { sublabel: "Mumbai" }),
      item("c2", "Reliance Industries", { sublabel: "Mumbai" }),
    ],
  },
  { heading: "Empty", items: [] },
];

describe("matches", () => {
  it("returns true for an empty query", () => {
    expect(matches("", "anything")).toBe(true);
    expect(matches("   ", "anything")).toBe(true);
  });

  it("is case-insensitive and searches across fields", () => {
    expect(matches("TATA", "tata steel", "mumbai")).toBe(true);
    expect(matches("mumbai", "tata steel", "mumbai")).toBe(true);
  });

  it("requires every whitespace-separated token to be present (AND)", () => {
    expect(matches("tata steel", "tata steel ltd")).toBe(true);
    expect(matches("tata reliance", "tata steel ltd")).toBe(false);
  });

  it("ignores null/undefined fields", () => {
    expect(matches("tata", null, undefined, "tata steel")).toBe(true);
  });
});

describe("itemMatches", () => {
  it("folds label, sublabel and keywords into the haystack", () => {
    const it0 = item("x", "New company", { sublabel: "start cadence", keywords: "create add" });
    expect(itemMatches(it0, "add")).toBe(true); // keyword only
    expect(itemMatches(it0, "cadence")).toBe(true); // sublabel only
    expect(itemMatches(it0, "delete")).toBe(false);
  });
});

describe("filterGroups", () => {
  it("returns non-empty groups unchanged for an empty query", () => {
    const out = filterGroups(groups(), "");
    expect(out.map((g) => g.heading)).toEqual(["Quick actions", "Companies"]);
  });

  it("drops groups whose items all fail the query", () => {
    const out = filterGroups(groups(), "tata");
    expect(out).toHaveLength(1);
    expect(out[0].heading).toBe("Companies");
    expect(out[0].items.map((i) => i.id)).toEqual(["c1"]);
  });

  it("returns nothing when no item matches", () => {
    expect(filterGroups(groups(), "zzz")).toEqual([]);
  });
});

describe("flattenGroups", () => {
  it("flattens in group order for keyboard indexing", () => {
    expect(flattenGroups(groups()).map((i) => i.id)).toEqual(["a1", "c1", "c2"]);
  });
});

describe("moveIndex", () => {
  it("wraps forward past the end", () => {
    expect(moveIndex(2, 3, 1)).toBe(0);
  });

  it("wraps backward past the start", () => {
    expect(moveIndex(0, 3, -1)).toBe(2);
  });

  it("advances normally in range", () => {
    expect(moveIndex(0, 3, 1)).toBe(1);
  });

  it("stays at 0 for an empty list", () => {
    expect(moveIndex(0, 0, 1)).toBe(0);
    expect(moveIndex(0, 0, -1)).toBe(0);
  });
});
