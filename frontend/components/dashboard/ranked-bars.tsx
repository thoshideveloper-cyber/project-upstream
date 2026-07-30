"use client";

import { cn } from "@/lib/utils";

export interface RankItem {
  label: string;
  /** Response rate as a fraction 0..1. */
  rate: number;
  total: number;
}

/** Ranked horizontal bars with a firm-average benchmark line. Segments above the
 *  benchmark read amber (outperforming); below read muted. The analyst's tool for
 *  "where is outreach actually landing?" */
export function RankedBars({
  items,
  benchmark,
  loading,
  empty,
}: {
  items: RankItem[];
  /** Firm-wide average rate (fraction 0..1) drawn as a reference line. */
  benchmark: number;
  loading?: boolean;
  empty: string;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  const sorted = [...items].sort((a, b) => b.rate - a.rate);
  const scaleMax = Math.max(benchmark, ...sorted.map((d) => d.rate), 0.01) * 1.1;
  const benchPct = (benchmark / scaleMax) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-widest">Ranked by response rate</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-px bg-foreground/40" />
          firm avg {Math.round(benchmark * 100)}%
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {sorted.map((d, i) => {
          const above = d.rate >= benchmark && d.rate > 0;
          const widthPct = Math.max(d.rate > 0 ? 3 : 0, (d.rate / scaleMax) * 100);
          return (
            <li key={`${d.label}-${i}`} className="flex items-center gap-3">
              <div className="flex shrink-0 items-center gap-2" style={{ width: "8.5rem" }}>
                <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate text-xs text-foreground" title={d.label}>
                  {d.label}
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
                    className={cn(
                      "font-mono text-[11px] font-semibold tabular-nums",
                      above ? "" : "text-foreground/70",
                    )}
                    style={above ? { color: "oklch(0.14 0.006 265)" } : undefined}
                  >
                    {Math.round(d.rate * 100)}%
                  </span>
                </div>
                {/* Firm-average benchmark line — scale is well-defined within the track */}
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-foreground/40"
                  style={{ left: `${benchPct}%` }}
                  aria-hidden
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {d.total.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/85" /> at / above avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/25" /> below avg
        </span>
        <span className="ml-auto">count →</span>
      </div>
    </div>
  );
}
