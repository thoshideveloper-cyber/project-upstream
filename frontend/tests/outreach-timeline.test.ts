import { describe, it, expect } from "vitest";

import {
  bandByCycle,
  buildTimeline,
  daysBetween,
  eventLabel,
  eventTone,
  formatEventDate,
  gapLabel,
  offsetLabel,
  stopsCadence,
  summarize,
} from "@/lib/outreach-timeline";
import type { OutreachEvent } from "@/types";

/** Unit tests for the pure outreach-timeline helpers (P3 cadence spine). */

let nextId = 1;
function ev(partial: Partial<OutreachEvent> & { occurred_on: string; event_type: string }): OutreachEvent {
  return {
    id: partial.id ?? nextId++,
    firm_id: 1,
    company_id: 10,
    schedule_id: null,
    contact_id: null,
    regarding: null,
    notes: null,
    mode: null,
    sentiment: null,
    owner_id: 1,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as OutreachEvent;
}

describe("daysBetween", () => {
  it("counts whole days forward and backward", () => {
    expect(daysBetween("2026-03-01", "2026-03-15")).toBe(14);
    expect(daysBetween("2026-03-15", "2026-03-01")).toBe(-14);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2); // 2026 is not a leap year
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("is 0 for unparseable input rather than NaN", () => {
    expect(daysBetween("", "2026-03-01")).toBe(0);
  });
});

describe("event language (plan.md §7.3)", () => {
  it("maps each event type to its status hue", () => {
    expect(eventTone("INITIAL_EMAIL")).toBe("violet");
    expect(eventTone("FOLLOW_UP")).toBe("slate");
    expect(eventTone("CALL")).toBe("slate");
    expect(eventTone("RESPONSE")).toBe("green");
    expect(eventTone("BOUNCE")).toBe("red");
    expect(eventTone("DECLINED")).toBe("amber");
    expect(eventTone("NOTE")).toBe("grey");
  });

  it("falls back to grey + a readable label for an unknown type", () => {
    expect(eventTone("SMOKE_SIGNAL")).toBe("grey");
    expect(eventLabel("SMOKE_SIGNAL")).toBe("smoke signal");
    expect(eventLabel("RESPONSE")).toBe("Response");
  });

  it("knows which touches stop the cadence (CLAUDE.md rule 4)", () => {
    expect(stopsCadence("RESPONSE")).toBe(true);
    expect(stopsCadence("BOUNCE")).toBe(true);
    expect(stopsCadence("DECLINED")).toBe(true);
    expect(stopsCadence("FOLLOW_UP")).toBe(false);
    expect(stopsCadence("NOTE")).toBe(false);
  });
});

describe("buildTimeline", () => {
  const events = [
    ev({ id: 3, occurred_on: "2026-03-29", event_type: "RESPONSE" }),
    ev({ id: 2, occurred_on: "2026-03-15", event_type: "FOLLOW_UP" }),
    ev({ id: 1, occurred_on: "2026-03-01", event_type: "INITIAL_EMAIL" }),
  ];

  it("returns newest first", () => {
    expect(buildTimeline(events).map((e) => e.event.id)).toEqual([3, 2, 1]);
  });

  it("is independent of the input order (the two APIs disagree)", () => {
    const asc = [...events].reverse();
    expect(buildTimeline(asc).map((e) => e.event.id)).toEqual([3, 2, 1]);
  });

  it("offsets every touch from the anchor and marks the anchor itself", () => {
    const [resp, follow, initial] = buildTimeline(events);
    expect(initial.isAnchor).toBe(true);
    expect(initial.dayOffset).toBe(0);
    expect(follow.dayOffset).toBe(14);
    expect(resp.dayOffset).toBe(28);
    expect(follow.isAnchor).toBe(false);
  });

  it("measures the gap to the previous touch", () => {
    const [resp, follow, initial] = buildTimeline(events);
    expect(initial.gapDays).toBe(null); // nothing before it
    expect(follow.gapDays).toBe(14);
    expect(resp.gapDays).toBe(14);
  });

  it("flags the touch that stopped the cadence", () => {
    expect(buildTimeline(events)[0].stops).toBe(true);
  });

  it("leaves offsets null until an anchor exists", () => {
    const noAnchor = [ev({ occurred_on: "2026-03-10", event_type: "NOTE" })];
    expect(buildTimeline(noAnchor)[0].dayOffset).toBe(null);
  });

  it("only the first INITIAL_EMAIL of a cycle is the anchor (immutable, rule 3)", () => {
    const doubled = [
      ev({ id: 2, occurred_on: "2026-03-05", event_type: "INITIAL_EMAIL" }),
      ev({ id: 1, occurred_on: "2026-03-01", event_type: "INITIAL_EMAIL" }),
    ];
    const [second, first] = buildTimeline(doubled);
    expect(first.isAnchor).toBe(true);
    expect(second.isAnchor).toBe(false);
    expect(second.dayOffset).toBe(4);
  });
});

describe("cadence cycles", () => {
  const cycles = [
    { id: 100, cycle_number: 1 },
    { id: 200, cycle_number: 2 },
  ];
  const events = [
    ev({ id: 4, occurred_on: "2026-06-14", event_type: "FOLLOW_UP", schedule_id: 200 }),
    ev({ id: 3, occurred_on: "2026-06-01", event_type: "INITIAL_EMAIL", schedule_id: 200 }),
    ev({ id: 2, occurred_on: "2026-03-15", event_type: "FOLLOW_UP", schedule_id: 100 }),
    ev({ id: 1, occurred_on: "2026-03-01", event_type: "INITIAL_EMAIL", schedule_id: 100 }),
  ];

  it("restarts the day count at the new cycle's anchor", () => {
    const [f2, i2, f1, i1] = buildTimeline(events, cycles);
    expect(i1.dayOffset).toBe(0);
    expect(f1.dayOffset).toBe(14);
    expect(i2.dayOffset).toBe(0); // not +92d from the first cycle
    expect(i2.isAnchor).toBe(true);
    expect(f2.dayOffset).toBe(13);
  });

  it("does not measure a gap across a cycle boundary", () => {
    const i2 = buildTimeline(events, cycles).find((e) => e.event.id === 3)!;
    expect(i2.gapDays).toBe(null);
  });

  it("bands entries by cycle, newest cycle first", () => {
    const bands = bandByCycle(buildTimeline(events, cycles));
    expect(bands.map((b) => b.cycleNumber)).toEqual([2, 1]);
    expect(bands[0].entries.map((e) => e.event.id)).toEqual([4, 3]);
    expect(bands[1].entries.map((e) => e.event.id)).toEqual([2, 1]);
  });

  it("keeps a schedule-less note in the band of the touch before it", () => {
    const withNote = [
      ev({ id: 5, occurred_on: "2026-06-20", event_type: "NOTE", schedule_id: null }),
      ...events,
    ];
    const bands = bandByCycle(buildTimeline(withNote, cycles));
    expect(bands).toHaveLength(2);
    expect(bands[0].cycleNumber).toBe(2);
    expect(bands[0].entries[0].event.id).toBe(5);
  });

  it("produces a single unheaded band when the company never restarted", () => {
    const bands = bandByCycle(buildTimeline(events.slice(2), [cycles[0]]));
    expect(bands).toHaveLength(1);
  });
});

describe("summarize", () => {
  it("counts outbound touches and replies over the whole span", () => {
    const s = summarize([
      ev({ occurred_on: "2026-03-29", event_type: "RESPONSE" }),
      ev({ occurred_on: "2026-03-20", event_type: "NOTE" }),
      ev({ occurred_on: "2026-03-15", event_type: "FOLLOW_UP" }),
      ev({ occurred_on: "2026-03-01", event_type: "INITIAL_EMAIL" }),
    ]);
    expect(s.total).toBe(4);
    expect(s.touches).toBe(2); // the note and the reply are not outbound touches
    expect(s.replies).toBe(1);
    expect(s.first).toBe("2026-03-01");
    expect(s.last).toBe("2026-03-29");
    expect(s.spanDays).toBe(28);
  });

  it("is safe on an empty log", () => {
    expect(summarize([])).toEqual({
      total: 0,
      first: null,
      last: null,
      spanDays: null,
      touches: 0,
      replies: 0,
    });
  });
});

describe("labels", () => {
  it("phrases gaps in the analyst's words", () => {
    expect(gapLabel(null)).toBe(null);
    expect(gapLabel(0)).toBe("same day");
    expect(gapLabel(1)).toBe("next day");
    expect(gapLabel(14)).toBe("14d later");
  });

  it("phrases offsets against the anchor", () => {
    expect(offsetLabel(null)).toBe(null);
    expect(offsetLabel(0)).toBe("day 0");
    expect(offsetLabel(14)).toBe("+14d");
  });

  it("formats dates by parts, so no timezone can shift the day", () => {
    expect(formatEventDate("2026-03-01")).toBe("1 Mar 2026");
    expect(formatEventDate("2026-12-31")).toBe("31 Dec 2026");
    expect(formatEventDate("not-a-date")).toBe("not-a-date");
  });
});
