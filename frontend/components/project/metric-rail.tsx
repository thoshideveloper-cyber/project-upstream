"use client";

/**
 * The metric rail — the project header's instrument row.
 *
 * Each figure is a cell with its own label, cells are separated by hairlines rather than
 * boxes, and every cell that has somewhere to go is a link — so the header is also the
 * fastest route into the work it describes. Six floating cards at the top of every
 * project page is the dashboard clutter this product avoids; a ruled rail carries the
 * same six numbers in a third of the height.
 *
 * Tone: a danger figure is red, a figure that is genuinely zero drops to grey and stops
 * being a link. Everything else is ink — a number is not good or bad until it is late.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { MONO } from "@/lib/design";
import { cn } from "@/lib/utils";

export interface Metric {
  key: string;
  label: string;
  value: string | number;
  /** Small trailing note — a denominator, a date, a share. */
  hint?: string;
  href?: string;
  tone?: "default" | "danger" | "awaiting" | "positive";
  /** Rendered muted and unclickable — for a figure that is genuinely zero. */
  quiet?: boolean;
}

const VALUE_TONE: Record<NonNullable<Metric["tone"]>, string> = {
  default: "text-foreground",
  danger: "text-danger-ink",
  awaiting: "text-foreground",
  positive: "text-foreground",
};

function Cell({ m }: { m: Metric }) {
  const linked = !!m.href && !m.quiet;
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {m.tone === "danger" && !m.quiet && (
          <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
        )}
        <span className="truncate">{m.label}</span>
        {linked && (
          <ArrowUpRight
            className="ml-auto size-3 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover/cell:opacity-100"
            aria-hidden
          />
        )}
      </span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-xl font-semibold leading-7 tracking-[-0.01em]",
            m.quiet ? "text-muted-foreground" : VALUE_TONE[m.tone ?? "default"],
          )}
          style={MONO}
        >
          {m.value}
        </span>
        {m.hint && (
          <span className="truncate text-xs text-muted-foreground" style={MONO}>
            {m.hint}
          </span>
        )}
      </span>
    </>
  );

  const cls = "group/cell block min-w-0 bg-card px-4 py-3";

  return linked ? (
    <Link
      href={m.href!}
      className={cn(
        cls,
        "transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
      )}
    >
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/**
 * Cells sit on a 1px gap over a border-coloured ground, so the hairlines are the gaps
 * themselves: they stay correct at 2, 3 or 6 columns without any cell needing to know
 * where it wrapped.
 */
export function MetricRail({
  metrics,
  className,
}: {
  metrics: Metric[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3 lg:grid-flow-col lg:grid-cols-none lg:auto-cols-fr",
        className,
      )}
    >
      {metrics.map((m) => (
        <Cell key={m.key} m={m} />
      ))}
    </div>
  );
}
