"use client";

import { useState } from "react";
import Link from "next/link";

import type { CategoryRow, LayerRow, SourceRow } from "@/hooks/use-analytics";
import { partitionRates, pctLabel, MIN_N, type RateRow } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { MONO } from "@/lib/design";

/**
 * Driver Board — one instrument, three dimensions. Folds the old "by category" and
 * "by sourcing layer" bars into a switchable board and adds source. Low-n recession
 * is the whole point: every row prints its denominator, a rate over n<MIN_N is greyed,
 * pushed below a "thin data" divider, excluded from the ranking, and never wins the
 * amber "at/above benchmark" treatment. Category rows drill to the master grid filtered.
 */

type Dim = "category" | "layer" | "source";

const DIMS: { id: Dim; label: string }[] = [
  { id: "category", label: "Category" },
  { id: "layer", label: "Sourcing layer" },
  { id: "source", label: "Source" },
];

function Row({ r, rank, benchmark, thin }: { r: RateRow; rank?: number; benchmark: number; thin?: boolean }) {
  const above = !thin && r.rate >= benchmark && r.rate > 0;
  const scaleMax = Math.max(benchmark, 0.01) * 2.4;
  const widthPct = Math.max(r.rate > 0 ? 3 : 0, Math.min(100, (r.rate / scaleMax) * 100));
  const benchPct = Math.min(100, (benchmark / scaleMax) * 100);

  const body = (
    <>
      <div className="flex w-36 shrink-0 items-center gap-2">
        <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
          {thin ? "·" : rank}
        </span>
        <span className={cn("truncate text-xs", thin ? "text-muted-foreground" : "text-foreground")} title={r.label}>
          {r.label}
        </span>
      </div>
      <div className="relative h-6 flex-1">
        <div className="absolute inset-0 rounded-md bg-muted/40" />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-end rounded-md pr-2 transition-[width] duration-700",
            above ? "bg-primary/85" : "bg-muted-foreground/25",
          )}
          style={{ width: `${widthPct}%` }}
        >
          <span
            className={cn("font-mono text-[11px] font-semibold tabular-nums", above ? "" : "text-foreground/70")}
            style={above ? { color: "oklch(0.14 0.006 265)" } : undefined}
          >
            {pctLabel(r.rate)}
          </span>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-foreground/40"
          style={{ left: `${benchPct}%` }}
          aria-hidden
        />
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground" style={MONO}>
        {r.responded}/{r.total}
      </span>
    </>
  );

  const cls = "flex items-center gap-3";
  return r.href && !thin ? (
    <Link href={r.href} className={cn(cls, "group rounded-md transition-colors hover:bg-primary/[0.04]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function DriverBoard({
  categories,
  layers,
  sources,
  benchmark,
  loading,
}: {
  categories: CategoryRow[];
  layers: LayerRow[];
  sources: SourceRow[];
  /** Firm response rate (responded ÷ total) as a fraction — the reference line. */
  benchmark: number;
  loading?: boolean;
}) {
  const [dim, setDim] = useState<Dim>("category");

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  const rows: RateRow[] =
    dim === "category"
      ? categories.map((c) => ({
          label: c.category,
          total: c.total,
          responded: c.responded,
          rate: c.response_rate,
          href: c.category_id ? `/master?view=firm-wide&category_id=${c.category_id}` : undefined,
        }))
      : dim === "layer"
        ? layers.map((l) => ({ label: l.layer, total: l.total, responded: l.responded, rate: l.response_rate }))
        : aggregateSources(sources);

  const { ranked, thin } = partitionRates(rows);

  return (
    <div className="flex flex-col gap-4">
      {/* Dimension switch */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg bg-muted p-[3px] text-xs text-muted-foreground">
          {DIMS.map((d) => {
            const active = dim === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setDim(d.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/50",
                  active ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-block h-3 w-px bg-foreground/40" />
          firm avg {pctLabel(benchmark)}
        </span>
      </div>

      {ranked.length === 0 && thin.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No data for this dimension.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ranked.map((r, i) => (
            <li key={r.label}>
              <Row r={r} rank={i + 1} benchmark={benchmark} />
            </li>
          ))}
          {thin.length > 0 && (
            <>
              <li className="flex items-center gap-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span className="h-px flex-1 bg-border/60" />
                Thin data · n&lt;{MIN_N}
                <span className="h-px flex-1 bg-border/60" />
              </li>
              {thin.map((r) => (
                <li key={r.label}>
                  <Row r={r} benchmark={benchmark} thin />
                </li>
              ))}
            </>
          )}
        </ul>
      )}

      <div className="flex items-center gap-4 pt-0.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/85" /> at / above avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/25" /> below avg
        </span>
        <span className="ml-auto">responded / total →</span>
      </div>
    </div>
  );
}

function aggregateSources(sources: SourceRow[]): RateRow[] {
  const by = new Map<string, { responded: number; total: number }>();
  for (const s of sources) {
    const key = s.source ?? "Unknown";
    const acc = by.get(key) ?? { responded: 0, total: 0 };
    acc.responded += s.responded;
    acc.total += s.total;
    by.set(key, acc);
  }
  return [...by.entries()].map(([label, v]) => ({
    label: label.charAt(0) + label.slice(1).toLowerCase(),
    total: v.total,
    responded: v.responded,
    rate: v.total ? v.responded / v.total : 0,
  }));
}
