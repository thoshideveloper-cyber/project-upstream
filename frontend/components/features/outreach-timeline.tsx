"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleDot,
  Clock,
  Mail,
  MessageSquare,
  Network,
  Phone,
  Send,
  ShieldCheck,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useUsers } from "@/hooks/use-users";
import { cn } from "@/lib/utils";
import {
  bandByCycle,
  buildTimeline,
  eventLabel,
  eventTone,
  formatEventDate,
  gapLabel,
  offsetLabel,
  summarize,
  type CycleRef,
  type EventTone,
  type TimelineEntry,
} from "@/lib/outreach-timeline";
import type { Contact, OutreachEvent, ScheduleStatus } from "@/types";

// ── Colour + icon language ───────────────────────────────────────────────────
// Tints are the literal plan.md §7.3 pills from StatusBadge, so a green node in
// the timeline is the same green as the "Responded" badge on the row above it.

const TONE: Record<EventTone, { chip: string; rule: string; text: string }> = {
  violet: {
    chip: "[background:oklch(0.93_0.045_270)] [color:oklch(0.48_0.15_270)] dark:[background:oklch(0.20_0.12_270_/_0.6)] dark:[color:oklch(0.72_0.18_270)]",
    rule: "[border-color:oklch(0.48_0.15_270_/_0.35)] dark:[border-color:oklch(0.72_0.18_270_/_0.35)]",
    text: "[color:oklch(0.48_0.15_270)] dark:[color:oklch(0.72_0.18_270)]",
  },
  slate: {
    chip: "[background:oklch(0.92_0.015_250)] [color:oklch(0.42_0.04_255)] dark:[background:oklch(0.30_0.02_265_/_0.6)] dark:[color:oklch(0.72_0.02_265)]",
    rule: "[border-color:oklch(0.42_0.04_255_/_0.3)] dark:[border-color:oklch(0.72_0.02_265_/_0.3)]",
    text: "[color:oklch(0.42_0.04_255)] dark:[color:oklch(0.72_0.02_265)]",
  },
  green: {
    chip: "[background:oklch(0.93_0.05_152)] [color:oklch(0.46_0.13_152)] dark:[background:oklch(0.20_0.10_152_/_0.6)] dark:[color:oklch(0.72_0.18_152)]",
    rule: "[border-color:oklch(0.46_0.13_152_/_0.35)] dark:[border-color:oklch(0.72_0.18_152_/_0.35)]",
    text: "[color:oklch(0.46_0.13_152)] dark:[color:oklch(0.72_0.18_152)]",
  },
  amber: {
    chip: "[background:oklch(0.94_0.05_75)] [color:oklch(0.52_0.12_60)] dark:[background:oklch(0.22_0.08_58_/_0.6)] dark:[color:oklch(0.78_0.16_58)]",
    rule: "[border-color:oklch(0.52_0.12_60_/_0.35)] dark:[border-color:oklch(0.78_0.16_58_/_0.35)]",
    text: "[color:oklch(0.52_0.12_60)] dark:[color:oklch(0.78_0.16_58)]",
  },
  red: {
    chip: "[background:oklch(0.93_0.05_25)] [color:oklch(0.52_0.20_25)] dark:[background:oklch(0.22_0.12_25_/_0.6)] dark:[color:oklch(0.72_0.22_25)]",
    rule: "[border-color:oklch(0.52_0.20_25_/_0.35)] dark:[border-color:oklch(0.72_0.22_25_/_0.35)]",
    text: "[color:oklch(0.52_0.20_25)] dark:[color:oklch(0.72_0.22_25)]",
  },
  grey: {
    chip: "[background:oklch(0.93_0.004_265)] [color:oklch(0.44_0.02_265)] dark:[background:oklch(0.25_0.01_265_/_0.6)] dark:[color:oklch(0.55_0.01_265)]",
    rule: "border-border",
    text: "text-muted-foreground",
  },
};

const EVENT_ICON: Record<string, LucideIcon> = {
  INITIAL_EMAIL: Mail,
  FOLLOW_UP: Send,
  RESPONSE: MessageSquare,
  BOUNCE: AlertTriangle,
  DECLINED: ShieldCheck,
  CALL: Phone,
  LINKEDIN: Network,
  MEETING: Users,
  NOTE: StickyNote,
};

const MODE_LABEL: Record<string, string> = {
  EMAIL: "Email",
  CALL: "Call",
  LINKEDIN: "LinkedIn",
  MEETING: "Meeting",
  EVENT: "Event",
};

const SENTIMENT: Record<string, { label: string; tone: EventTone }> = {
  POSITIVE: { label: "Positive", tone: "green" },
  NEGATIVE: { label: "Negative", tone: "red" },
  NEUTRAL: { label: "Neutral", tone: "slate" },
};

// ── Small parts ──────────────────────────────────────────────────────────────

// Centre of the 32px chip column: 16px, with the 1px rule centred on it.
const RAIL_X = "left-4 -translate-x-1/2";

function Pill({ tone, children }: { tone: EventTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium whitespace-nowrap",
        TONE[tone].chip,
      )}
    >
      {children}
    </span>
  );
}

/** Mono micro-label on the rail: the rhythm between two touches. */
function GapMarker({ label }: { label: string }) {
  return (
    <li aria-hidden className="relative flex h-5 items-center gap-3.5">
      <span className="flex w-8 justify-center">
        <span className="size-1 rounded-full bg-border" />
      </span>
      <span className="font-mono text-[10px] tracking-wide text-muted-foreground tabular-nums">
        {label}
      </span>
    </li>
  );
}

// ── The live head of the spine ───────────────────────────────────────────────

export interface TimelineCadence {
  scheduleStatus: ScheduleStatus | null;
  nextDueDate?: string | null;
  daysRemaining?: number | null;
  isOverdue?: boolean;
  stoppedReason?: string | null;
}

/**
 * What the log says happens next. Server-computed values only — the timeline
 * never derives next-due or overdue itself (CLAUDE.md rule 2).
 */
function HeadNode({ cadence }: { cadence: TimelineCadence }) {
  const { scheduleStatus, nextDueDate, daysRemaining, isOverdue, stoppedReason } = cadence;

  let tone: EventTone = "slate";
  let title = "";
  let detail: string | null = null;

  if (scheduleStatus === "AWAITING_INITIAL") {
    tone = "violet";
    title = "Awaiting the first email";
    detail = "The cadence clock starts the day the initial email is logged — not before.";
  } else if (scheduleStatus === "STOPPED") {
    tone = "grey";
    title = "Cadence stopped";
    detail = stoppedReason
      ? `Reason: ${stoppedReason.toLowerCase().replace(/_/g, " ")}. No further follow-ups are scheduled.`
      : "No further follow-ups are scheduled.";
  } else if (nextDueDate) {
    tone = isOverdue ? "red" : "amber";
    title = `Next follow-up · ${formatEventDate(nextDueDate)}`;
    detail =
      daysRemaining == null
        ? null
        : isOverdue
          ? `${Math.abs(daysRemaining)}d overdue`
          : daysRemaining === 0
            ? "due today"
            : `due in ${daysRemaining}d`;
  } else {
    return null;
  }

  return (
    <li className="relative flex gap-3.5 pb-5">
      <span
        className={cn(
          "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed bg-card",
          TONE[tone].rule,
        )}
      >
        <Clock className={cn("size-3.5", TONE[tone].text)} />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-medium">{title}</p>
        {detail && (
          <p className={cn("mt-0.5 text-xs", isOverdue ? TONE.red.text : "text-muted-foreground")}>
            {detail}
          </p>
        )}
      </div>
    </li>
  );
}

// ── One logged event ─────────────────────────────────────────────────────────

function EntryNode({
  entry,
  contactName,
  ownerName,
}: {
  entry: TimelineEntry;
  contactName?: string;
  ownerName?: string;
}) {
  const { event } = entry;
  const tone = eventTone(event.event_type);
  const Icon = EVENT_ICON[event.event_type] ?? CircleDot;
  const offset = offsetLabel(entry.dayOffset);
  const sentiment = event.sentiment ? SENTIMENT[event.sentiment] : undefined;

  const meta = [
    contactName ? `with ${contactName}` : null,
    event.mode ? (MODE_LABEL[event.mode] ?? event.mode) : null,
    ownerName ? `logged by ${ownerName}` : null,
  ].filter(Boolean) as string[];

  return (
    <li className="relative flex gap-3.5 pb-5">
      <span
        className={cn(
          "z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
          TONE[tone].chip,
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-medium">{eventLabel(event.event_type)}</p>
          {entry.isAnchor && <Pill tone="violet">anchor · day 0</Pill>}
          {entry.stops && <Pill tone={tone}>stopped the cadence</Pill>}
          {sentiment && <Pill tone={sentiment.tone}>{sentiment.label}</Pill>}
          <span className="ml-auto flex shrink-0 items-baseline gap-2">
            {offset && !entry.isAnchor && (
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {offset}
              </span>
            )}
            <time
              dateTime={event.occurred_on}
              className="text-xs text-muted-foreground tabular-nums"
            >
              {formatEventDate(event.occurred_on)}
            </time>
          </span>
        </div>

        {meta.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{meta.join(" · ")}</p>
        )}

        {event.regarding && (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="text-foreground/70">Re:</span> {event.regarding}
          </p>
        )}

        {event.notes && (
          <p className="mt-1.5 border-l-2 border-border pl-2.5 text-xs leading-relaxed text-foreground/80">
            {event.notes}
          </p>
        )}
      </div>
    </li>
  );
}

// ── The timeline ─────────────────────────────────────────────────────────────

export interface OutreachTimelineProps {
  /** The append-only log, newest first (the order the API returns). */
  events: OutreachEvent[];
  /** Contacts of the company, to attribute a touch to a person. */
  contacts?: Contact[];
  /** Cadence cycles, when the company has restarted — bands the spine. */
  cycles?: CycleRef[];
  /** Server-computed cadence state, rendered as the live head of the spine. */
  cadence?: TimelineCadence;
  /** Rendered in the empty state (e.g. a "Log outreach" button). */
  emptyAction?: React.ReactNode;
  /** Hides the summary strip — for narrow panels like the contact page. */
  compact?: boolean;
  className?: string;
}

const INITIAL_VISIBLE = 8;

export function OutreachTimeline({
  events,
  contacts = [],
  cycles = [],
  cadence,
  emptyAction,
  compact = false,
  className,
}: OutreachTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  // Names within a firm are not sensitive (see the /users endpoint); if the
  // request fails the timeline simply drops the attribution line.
  const { data: usersData } = useUsers();

  const contactName = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of contacts) m.set(c.id, c.contact_person);
    return m;
  }, [contacts]);

  const ownerName = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of usersData?.items ?? []) m.set(u.id, u.full_name);
    return m;
  }, [usersData]);

  const entries = useMemo(() => buildTimeline(events, cycles), [events, cycles]);
  const stats = useMemo(() => summarize(events), [events]);

  if (!events.length) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center",
          className,
        )}
      >
        <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-4 text-primary-ink/50" />
        </span>
        <h3 className="text-sm font-medium">Nothing logged yet</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Every email, call and reply lands here — appended, never overwritten.
        </p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  const visible = expanded ? entries : entries.slice(0, INITIAL_VISIBLE);
  const hidden = entries.length - visible.length;
  const bands = bandByCycle(visible);
  // Label the bands whenever the company has restarted — including the common
  // case where every logged event still belongs to the previous cycle.
  const multiCycle = cycles.length > 1 || new Set(entries.map((e) => e.cycleNumber)).size > 1;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground tabular-nums">{stats.touches}</span> touches
          </span>
          <span>
            <span className="font-medium text-foreground tabular-nums">{stats.replies}</span>{" "}
            {stats.replies === 1 ? "reply" : "replies"}
          </span>
          {stats.first && (
            <span>
              first contact{" "}
              <span className="font-medium text-foreground">{formatEventDate(stats.first)}</span>
            </span>
          )}
          {stats.spanDays != null && stats.spanDays > 0 && (
            <span className="tabular-nums">over {stats.spanDays}d</span>
          )}
        </div>
      )}

      <ol className="relative">
        {/* The spine. Sits behind the chips, which carry a card-coloured ring. */}
        <span
          aria-hidden
          className={cn("absolute top-4 bottom-4 w-px bg-border", RAIL_X)}
        />

        {cadence && <HeadNode cadence={cadence} />}

        {bands.map((band) => (
          <Fragment key={band.cycleNumber ?? "none"}>
            {multiCycle && band.cycleNumber != null && (
              <li className="relative mb-3 flex items-center gap-3.5 pl-[2.875rem]">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Cycle {band.cycleNumber}
                </span>
                <span className="h-px flex-1 bg-border" />
              </li>
            )}
            {band.entries.map((entry, i) => {
              const gap = gapLabel(entry.gapDays);
              return (
                <Fragment key={entry.event.id}>
                  <EntryNode
                    entry={entry}
                    contactName={
                      entry.event.contact_id != null
                        ? contactName.get(entry.event.contact_id)
                        : undefined
                    }
                    ownerName={
                      entry.event.owner_id != null ? ownerName.get(entry.event.owner_id) : undefined
                    }
                  />
                  {/* The gap reads downward: this touch came N days after the one below it. */}
                  {gap && i < band.entries.length - 1 && <GapMarker label={gap} />}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </ol>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Show {hidden} earlier {hidden === 1 ? "entry" : "entries"}
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Append-only log — entries are never edited or deleted. A correction is logged as a new note.
      </p>
    </div>
  );
}
