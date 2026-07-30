import { describe, it, expect } from "vitest";

import {
  allSelected,
  pruneSelection,
  selectedCount,
  toggle,
  toggleMany,
} from "@/lib/selection";

/** Unit tests for the pure row-selection helpers (P2 bulk actions). */

describe("toggle", () => {
  it("adds an absent id and removes a present one, returning a new set", () => {
    const a = new Set<number>([1]);
    const b = toggle(a, 2);
    expect([...b].sort()).toEqual([1, 2]);
    expect(b).not.toBe(a);
    expect([...toggle(b, 1)]).toEqual([2]);
  });
});

describe("selectedCount / allSelected", () => {
  it("counts the intersection with a group", () => {
    expect(selectedCount(new Set([1, 2, 5]), [1, 2, 3])).toBe(2);
  });

  it("allSelected is true only when every group id is in, and false for an empty group", () => {
    expect(allSelected(new Set([1, 2, 3]), [1, 2])).toBe(true);
    expect(allSelected(new Set([1]), [1, 2])).toBe(false);
    expect(allSelected(new Set([1]), [])).toBe(false);
  });
});

describe("toggleMany", () => {
  it("adds the whole group when not all selected", () => {
    expect([...toggleMany(new Set([1]), [1, 2, 3])].sort()).toEqual([1, 2, 3]);
  });

  it("clears the group when all are selected, leaving outside ids intact", () => {
    expect([...toggleMany(new Set([1, 2, 9]), [1, 2])]).toEqual([9]);
  });
});

describe("pruneSelection", () => {
  it("drops ids no longer valid and keeps the same reference when unchanged", () => {
    const sel = new Set([1, 2, 3]);
    expect([...pruneSelection(sel, [2, 3, 4])].sort()).toEqual([2, 3]);
    expect(pruneSelection(sel, [1, 2, 3])).toBe(sel);
  });
});
