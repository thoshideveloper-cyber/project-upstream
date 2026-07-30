import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { bookComposition, isThin, partitionRates, pctLabel, replyRate, MIN_N } from "@/lib/analytics";
import { useDelayed } from "@/hooks/use-delayed";

/** P4 — the numbers behind the analytics panels, and the skeleton-delay gate. */

describe("replyRate", () => {
  it("divides by the contacted set, never by the whole book", () => {
    // 100 companies, 20 emailed, 5 replied → 25%, not 5%.
    expect(replyRate(20, 5)).toBeCloseTo(0.25);
    expect(pctLabel(replyRate(20, 5))).toBe("25%");
  });

  it("is 0 when nobody has been contacted (never NaN or Infinity)", () => {
    expect(replyRate(0, 0)).toBe(0);
    expect(replyRate(0, 3)).toBe(0);
    expect(Number.isFinite(replyRate(0, 3))).toBe(true);
  });
});

describe("bookComposition", () => {
  it("splits a book into replied / silent / untouched", () => {
    expect(bookComposition({ total: 100, contacted: 40, replied: 12 })).toEqual({
      replied: 12,
      noReply: 28,
      untouched: 60,
    });
  });

  it("segments always sum back to the total", () => {
    const c = bookComposition({ total: 57, contacted: 31, replied: 8 });
    expect(c.replied + c.noReply + c.untouched).toBe(57);
  });

  it("clamps an inconsistent payload instead of rendering a negative bar", () => {
    // contacted > total and replied > contacted (stale or partial response)
    const c = bookComposition({ total: 10, contacted: 25, replied: 40 });
    expect(c.replied).toBe(10);
    expect(c.noReply).toBe(0);
    expect(c.untouched).toBe(0);
    expect(c.replied + c.noReply + c.untouched).toBe(10);
  });

  it("handles an untouched book and a negative total", () => {
    expect(bookComposition({ total: 8, contacted: 0, replied: 0 })).toEqual({
      replied: 0,
      noReply: 0,
      untouched: 8,
    });
    expect(bookComposition({ total: -3, contacted: -1, replied: -1 })).toEqual({
      replied: 0,
      noReply: 0,
      untouched: 0,
    });
  });
});

describe("low-n recession", () => {
  it("treats a sample below MIN_N as thin", () => {
    expect(isThin(MIN_N - 1)).toBe(true);
    expect(isThin(MIN_N)).toBe(false);
  });

  it("ranks only healthy-n rows, and never lets a 1/1 row win", () => {
    const { ranked, thin } = partitionRates([
      { label: "Strategic", total: 40, responded: 8, rate: 0.2 },
      { label: "PE", total: 12, responded: 4, rate: 0.333 },
      { label: "Family office", total: 1, responded: 1, rate: 1 },
    ]);
    expect(ranked.map((r) => r.label)).toEqual(["PE", "Strategic"]);
    expect(thin.map((r) => r.label)).toEqual(["Family office"]);
  });
});

describe("useDelayed", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays false for a load that resolves before the delay (no skeleton flash)", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useDelayed(active, 300), {
      initialProps: { active: true },
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(120);
    });
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it("goes true once the wait passes the delay", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayed(true, 300));
    act(() => {
      vi.advanceTimersByTime(301);
    });
    expect(result.current).toBe(true);
  });

  it("drops back to false the moment the load finishes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useDelayed(active, 300), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it("re-arms the delay for the next load rather than firing instantly", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useDelayed(active, 300), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    rerender({ active: false });
    rerender({ active: true });
    expect(result.current).toBe(false); // not instantly true again
    act(() => {
      vi.advanceTimersByTime(301);
    });
    expect(result.current).toBe(true);
  });
});
