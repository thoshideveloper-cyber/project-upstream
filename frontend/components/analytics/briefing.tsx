"use client";

/**
 * The pieces a project briefing is made of.
 *
 * The old analytics page was a grid of bordered panels: chart card, chart card, chart
 * card, category card, band card, intervention card. Boxes are what you reach for when
 * the sections have no relationship to each other — and they enforce that reading, since
 * a box says "this is a separate object" whatever is inside it.
 *
 * A briefing is a document. So there are no cards here. A section is a rule, a title, a
 * sentence saying what the section answers, and its content. Hierarchy comes from type
 * and space; separation comes from a hairline. That is also why every figure below is a
 * link: a document that cannot be followed anywhere is a report, and the brief was
 * explicit that this should be a way into the records instead.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LABEL, MONO, SEG_GROUP, SEG_ITEM, SEG_ITEM_OFF, SEG_ITEM_ON } from "@/lib/design";
import { cn } from "@/lib/utils";

/* ── Section ───────────────────────────────────────────────────────────────── */

export function Section({
  title,
  lead,
  aside,
  children,
  className,
}: {
  title: string;
  /** One line: the question this section answers. Never a restatement of the title. */
  lead?: string;
  /** A control that belongs to this section — a toggle, a sort, a range. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-border pt-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {lead && <p className="mt-0.5 text-xs text-muted-foreground">{lead}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ── Figures ───────────────────────────────────────────────────────────────── */

export interface Figure {
  key: string;
  label: string;
  value: string;
  /** The denominator, or whatever makes the value mean something. Never decoration. */
  sub?: string;
  href?: string;
  tone?: "default" | "danger" | "awaiting" | "positive";
  quiet?: boolean;
}

/**
 * Figure tones in ink, the same three as the project header's rail: danger is inverted
 * (the one black block in the row), awaiting is italic (nothing has gone out yet), and
 * positive news needs no emphasis at all — it is the number reading normally.
 */
const TONE = {
  default: "text-foreground",
  danger: "text-danger-ink",
  awaiting: "text-foreground",
  positive: "text-foreground",
};

/**
 * The summary row: six figures, each carrying its own denominator.
 *
 * Not six cards. A rate with no denominator beside it is the single most common way a
 * dashboard lies by omission — "48%" over four contacted companies and "48%" over four
 * hundred are the same glyphs and completely different facts.
 */
export function FigureRail({ figures }: { figures: Figure[] }) {
  return (
    <dl className="flex flex-wrap items-stretch gap-y-3 divide-x divide-border">
      {figures.map((f) => {
        const body = (
          <>
            <dt className={cn(LABEL, "block truncate")}>{f.label}</dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-lg font-semibold leading-none tabular-nums tracking-tight",
                  f.quiet ? "text-muted-foreground" : TONE[f.tone ?? "default"],
                )}
                style={MONO}
              >
                {f.value}
              </span>
              {f.sub && (
                <span className="truncate text-[11px] text-muted-foreground">{f.sub}</span>
              )}
            </dd>
          </>
        );
        const cls = "min-w-[7.5rem] flex-1 px-3.5 first:pl-0";
        return f.href && !f.quiet ? (
          <Link
            key={f.key}
            href={f.href}
            className={cn(
              cls,
              "rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {body}
          </Link>
        ) : (
          <div key={f.key} className={cls}>
            {body}
          </div>
        );
      })}
    </dl>
  );
}

/* ── Drill-through row ─────────────────────────────────────────────────────── */

/**
 * A count, what it means, and the records behind it.
 *
 * The brief's sharpest requirement: analytics must never dead-end. So the intervention
 * list is not a list of numbers with a heading — every row is a link into the workspace
 * view that holds exactly those records, and the arrow says so.
 */
export function InterventionRow({
  value,
  label,
  hint,
  href,
  tone = "default",
}: {
  value: number;
  label: string;
  hint: string;
  href: string;
  tone?: "default" | "danger" | "awaiting";
}) {
  const zero = value === 0;
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-lg py-2.5 pl-1 pr-2 transition-colors hover:bg-accent"
      >
        <span className="w-14 shrink-0 text-right">
          <span
            className={cn(
              "inline-block text-xl font-semibold leading-none tabular-nums tracking-tight",
              zero ? "text-muted-foreground" : TONE[tone],
            )}
            style={MONO}
          >
            {value}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </li>
  );
}

/* ── Magnitude bar ─────────────────────────────────────────────────────────── */

/**
 * One ink for magnitude, always.
 *
 * Rate bars across the briefing (segments, engagement volume) are all the same solid
 * ink. A rate is a magnitude, not a category, so shading the fast ones darker than the
 * slow ones would be encoding a judgement the data has not made. `muted` is for a
 * sample too thin to read a rate from.
 */
export function Bar({
  fraction,
  className,
  tone = "brand",
}: {
  fraction: number;
  className?: string;
  tone?: "brand" | "muted";
}) {
  return (
    <span
      className={cn("block h-1.5 overflow-hidden rounded-[2px] bg-ink-100", className)}
      aria-hidden
    >
      <span
        className={cn(
          "horizon-load block h-full rounded-[2px]",
          tone === "brand" ? "bg-foreground" : "bg-ink-300",
        )}
        style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
      />
    </span>
  );
}

/* ── Sort control ──────────────────────────────────────────────────────────── */

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className={SEG_GROUP}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(SEG_ITEM, value === o.value ? SEG_ITEM_ON : SEG_ITEM_OFF)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
