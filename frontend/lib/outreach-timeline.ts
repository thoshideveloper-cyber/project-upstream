/**
 * Pure helpers for the outreach timeline — the append-only log rendered as a
 * cadence spine. React-free so the arithmetic (anchor offsets, gaps between
 * touches, cycle banding) is unit-testable in isolation.
 *
 * Nothing here recomputes cadence: next-due / days-remaining / overdue always
 * arrive from the server (CLAUDE.md rule 2). Day offsets below are descriptive
 * arithmetic over dates the server already committed to the log.
 */

import type { OutreachEvent } from "@/types";

/** plan.md §7.3 status-colour language, reused verbatim for event types. */
/**
 * What an event does to the relationship — named for its role, not a hue, because the
 * product has no hues. `anchor` starts the clock, `touch` is us reaching out, `reply` is
 * them answering, `alarm` is an address that never arrived, `closed` is a no, and
 * `note` is an annotation rather than a touch.
 */
export type EventTone = "anchor" | "touch" | "reply" | "alarm" | "closed" | "note";

export const EVENT_LABEL: Record<string, string> = {
  INITIAL_EMAIL: "Initial email",
  FOLLOW_UP: "Follow-up",
  RESPONSE: "Response",
  BOUNCE: "Bounce",
  DECLINED: "Declined",
  CALL: "Call",
  LINKEDIN: "LinkedIn",
  MEETING: "Meeting",
  NOTE: "Note",
};

/**
 * Event types take the role of the state they put the company in, which makes the
 * spine readable as one sentence: the anchor starts it, touches are us reaching out, a
 * reply is them answering, an alarm or a no ends it, a note is an aside. Channel is
 * carried by the icon, never by a new treatment — one language.
 */
export const EVENT_TONE: Record<string, EventTone> = {
  INITIAL_EMAIL: "anchor", // day 0 — the clock starts here (CLAUDE.md rule 3)
  FOLLOW_UP: "touch",
  CALL: "touch",
  LINKEDIN: "touch",
  MEETING: "touch",
  RESPONSE: "reply",
  BOUNCE: "alarm",
  DECLINED: "closed",
  NOTE: "note", // not a touch — an annotation
};

/** Touches that stop the cadence (CLAUDE.md rule 4). */
const STOPPING = new Set(["RESPONSE", "BOUNCE", "DECLINED"]);

export function stopsCadence(eventType: string): boolean {
  return STOPPING.has(eventType);
}

export function eventLabel(eventType: string): string {
  return EVENT_LABEL[eventType] ?? eventType.replace(/_/g, " ").toLowerCase();
}

export function eventTone(eventType: string): EventTone {
  return EVENT_TONE[eventType] ?? "note";
}

/** Whole days from `from` to `to` for ISO `YYYY-MM-DD` dates. Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export interface TimelineEntry {
  event: OutreachEvent;
  /** Days since this cycle's anchor (the INITIAL_EMAIL). `null` until an anchor exists. */
  dayOffset: number | null;
  /** Days since the previous (chronologically earlier) touch in the same cycle. */
  gapDays: number | null;
  /** This event set the cycle's anchor — the fixed date the cadence counts from. */
  isAnchor: boolean;
  /** This event stopped the cadence. */
  stops: boolean;
  /** Cadence cycle this event belongs to (1-based); `null` when unknown. */
  cycleNumber: number | null;
}

export interface CycleRef {
  id: number;
  cycle_number: number;
  initial_date?: string | null;
  status?: string;
  stopped_reason?: string | null;
}

/**
 * Turn the raw log into timeline entries, newest first (the order the API
 * returns). Offsets and gaps are computed per cadence cycle, so a restarted
 * company reads as "day 0" again rather than "+412d".
 */
export function buildTimeline(
  events: OutreachEvent[],
  cycles: CycleRef[] = [],
): TimelineEntry[] {
  const cycleByScheduleId = new Map<number, number>();
  for (const c of cycles) cycleByScheduleId.set(c.id, c.cycle_number);

  // Work oldest-first so "previous touch" and "the anchor" are already known.
  const asc = [...events].sort(
    (a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.id - b.id,
  );

  const anchorByCycle = new Map<number | string, string>();
  const lastDateByCycle = new Map<number | string, string>();
  let lastCycle: number | null = null;

  const ascEntries: TimelineEntry[] = asc.map((event) => {
    // Events logged outside a schedule (a bare NOTE) inherit the band of the
    // touch before them, so they never open a phantom cycle.
    const mapped = event.schedule_id != null ? cycleByScheduleId.get(event.schedule_id) : undefined;
    const cycleNumber = mapped ?? lastCycle;
    if (mapped != null) lastCycle = mapped;
    const key = cycleNumber ?? "none";

    const isAnchor = event.event_type === "INITIAL_EMAIL" && !anchorByCycle.has(key);
    if (isAnchor) anchorByCycle.set(key, event.occurred_on);

    const anchor = anchorByCycle.get(key);
    const prev = lastDateByCycle.get(key);
    lastDateByCycle.set(key, event.occurred_on);

    return {
      event,
      dayOffset: anchor ? daysBetween(anchor, event.occurred_on) : null,
      gapDays: prev ? daysBetween(prev, event.occurred_on) : null,
      isAnchor,
      stops: stopsCadence(event.event_type),
      cycleNumber: cycleNumber ?? null,
    };
  });

  return ascEntries.reverse();
}

export interface CycleBand {
  cycleNumber: number | null;
  entries: TimelineEntry[];
}

/**
 * Split entries into cadence-cycle bands, newest cycle first. A company that
 * never restarted gets a single band, which the UI renders without a header.
 */
export function bandByCycle(entries: TimelineEntry[]): CycleBand[] {
  const bands: CycleBand[] = [];
  for (const e of entries) {
    const last = bands[bands.length - 1];
    if (last && last.cycleNumber === e.cycleNumber) last.entries.push(e);
    else bands.push({ cycleNumber: e.cycleNumber, entries: [e] });
  }
  return bands;
}

export interface TimelineSummary {
  total: number;
  /** Earliest touch date in the log. */
  first: string | null;
  /** Most recent touch date in the log. */
  last: string | null;
  /** Days from the first touch to the last. */
  spanDays: number | null;
  /** Count of outbound touches (emails, calls, LinkedIn, meetings) — excludes notes and replies. */
  touches: number;
  /** Count of inbound replies. */
  replies: number;
}

const OUTBOUND = new Set(["INITIAL_EMAIL", "FOLLOW_UP", "CALL", "LINKEDIN", "MEETING"]);

export function summarize(events: OutreachEvent[]): TimelineSummary {
  if (!events.length) {
    return { total: 0, first: null, last: null, spanDays: null, touches: 0, replies: 0 };
  }
  const dates = events.map((e) => e.occurred_on).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return {
    total: events.length,
    first,
    last,
    spanDays: daysBetween(first, last),
    touches: events.filter((e) => OUTBOUND.has(e.event_type)).length,
    replies: events.filter((e) => e.event_type === "RESPONSE").length,
  };
}

/** "14d later" / "same day" — the rhythm between two touches. */
export function gapLabel(gapDays: number | null): string | null {
  if (gapDays === null) return null;
  if (gapDays <= 0) return "same day";
  if (gapDays === 1) return "next day";
  return `${gapDays}d later`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "12 Mar 2026" from an ISO `YYYY-MM-DD`. Parsed by parts rather than through
 * `Date`, so a log entry never shifts a day across timezones.
 */
export function formatEventDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return iso ?? "";
  const [, y, mo, d] = m;
  const month = MONTHS[Number(mo) - 1];
  if (!month) return iso;
  return `${Number(d)} ${month} ${y}`;
}

/** "day 0" / "+14d" — where a touch sits relative to the immutable anchor. */
export function offsetLabel(dayOffset: number | null): string | null {
  if (dayOffset === null) return null;
  if (dayOffset === 0) return "day 0";
  return `+${dayOffset}d`;
}
