"use client";

/**
 * The health bar — the one instrument every level of the product's hierarchy shares:
 * a project on the projects list, an engagement in the overview, a book in the workspace.
 *
 * It says two things at once:
 *   • how *big* a group is, by the bar's width against the widest sibling
 *   • what *state* that group is in, by the segments inside it
 *
 * so a collapsed group still answers "how much, and how much of it is late" — which is
 * the only reason collapsing something is safe.
 *
 * Colour marks only the exceptions: late is red, replied is green, intros that never
 * went out are hollow (the record exists, the clock has not started). The bulk of any
 * book — contacted and running — is neutral ink, so a bar that is mostly grey is a
 * healthy bar and the red is impossible to miss. The order never changes, so the same
 * state sits in the same place on every row and two bars compare without reading either.
 */

import type { Vitals } from "@/lib/project";
import { cn } from "@/lib/utils";

export interface HealthSegment {
  key: string;
  label: string;
  n: number;
  cls: string;
}

const SEGMENT_CLS = {
  late: "bg-danger",
  awaiting: "ink-hollow",
  replied: "bg-success",
  working: "bg-ink-400",
  cold: "bg-ink-200",
} as const;

export function healthSegments(v: Vitals): HealthSegment[] {
  // The remainder: contacted, running, and none of the named states. Derived by
  // subtraction so the segments always sum to the total and the bar never lies.
  const working = Math.max(0, v.total - v.late - v.awaiting - v.replied - v.cold);
  return [
    { key: "late", label: "late", n: v.late, cls: SEGMENT_CLS.late },
    { key: "awaiting", label: "intro pending", n: v.awaiting, cls: SEGMENT_CLS.awaiting },
    { key: "replied", label: "replied", n: v.replied, cls: SEGMENT_CLS.replied },
    { key: "working", label: "in progress", n: working, cls: SEGMENT_CLS.working },
    { key: "cold", label: "cold", n: v.cold, cls: SEGMENT_CLS.cold },
  ];
}

export function HealthBar({
  vitals,
  /** The widest sibling, so bars in one list share a scale. Omit for full width. */
  scaleTo,
  size = "md",
  delay = 0,
  className,
}: {
  vitals: Vitals;
  scaleTo?: number;
  size?: "sm" | "md";
  delay?: number;
  className?: string;
}) {
  const segs = healthSegments(vitals).filter((s) => s.n > 0);
  const total = vitals.total;

  // A minimum width, so a one-company group is still a visible mark rather than a
  // rounding error next to a group of three hundred.
  const widthPct =
    scaleTo && scaleTo > 0 && total > 0 ? Math.max(6, (total / scaleTo) * 100) : total > 0 ? 100 : 0;

  const title = segs.length
    ? segs.map((s) => `${s.n} ${s.label}`).join(" · ")
    : "No companies yet";

  return (
    <span
      className={cn(
        "block w-full overflow-hidden rounded-full bg-ink-100",
        size === "sm" ? "h-1" : "h-1.5",
        className,
      )}
      title={title}
      aria-hidden
    >
      <span
        className="horizon-load flex h-full gap-px overflow-hidden rounded-full"
        style={{ width: `${widthPct}%`, "--load-delay": `${delay}ms` } as React.CSSProperties}
      >
        {total > 0 &&
          segs.map((s) => (
            <span
              key={s.key}
              className={cn("h-full", s.cls)}
              style={{ width: `${(s.n / total) * 100}%` }}
            />
          ))}
      </span>
    </span>
  );
}

/**
 * The bar's key. Rendered once per screen, never per row — a legend beside every bar
 * is the fastest way to turn a dense list into noise.
 */
export function HealthLegend({ className }: { className?: string }) {
  const keys = [
    { label: "Late", cls: SEGMENT_CLS.late },
    { label: "Intro pending", cls: SEGMENT_CLS.awaiting },
    { label: "Replied", cls: SEGMENT_CLS.replied },
    { label: "In progress", cls: SEGMENT_CLS.working },
    { label: "Cold", cls: SEGMENT_CLS.cold },
  ];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-1", className)} aria-label="Bar key">
      {keys.map((k) => (
        <li key={k.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-1.5 w-3 rounded-full", k.cls)} aria-hidden />
          {k.label}
        </li>
      ))}
    </ul>
  );
}
