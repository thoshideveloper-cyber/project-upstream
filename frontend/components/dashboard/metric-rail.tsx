"use client";

import type { LucideIcon } from "lucide-react";

import { MONO, PANEL } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * A row of headline figures as one ruled strip — not a grid of floating cards with an
 * icon in each corner. Cells share hairlines (the gaps over a border-coloured ground), so
 * the strip reads as one instrument and stays correct at 2, 3 or 5 columns.
 */

/** Compact inline sparkline — a line and its last point, no fill. */
function Sparkline({ data, tone = "primary" }: { data: number[]; tone?: "primary" | "positive" }) {
  const w = 88;
  const h = 28;
  if (data.length < 2 || data.every((d) => d === 0)) {
    return (
      <svg width={w} height={h} aria-hidden>
        <line x1={0} y1={h - 4} x2={w} y2={h - 4} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3" />
      </svg>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stroke = tone === "positive" ? "var(--success)" : "var(--ink-500)";
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 3 - ((d - min) / span) * (h - 6);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 overflow-visible">
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={stroke} />
    </svg>
  );
}

export interface Metric {
  label: string;
  value: number | null;
  /** Accepted for compatibility; the strip no longer decorates cells with icons. */
  icon?: LucideIcon;
  isPercent?: boolean;
  hint?: string;
  delta?: number | null;
  spark?: number[];
  sparkTone?: "primary" | "positive";
}

function MetricCell({ m }: { m: Metric }) {
  const shown = m.value === null ? "—" : m.isPercent ? `${m.value}%` : m.value.toLocaleString();
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5">
      <span className="truncate text-xs font-medium text-muted-foreground">{m.label}</span>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold leading-8 tracking-[-0.01em] text-foreground" style={MONO}>
              {shown}
            </span>
            {m.delta != null && m.delta !== 0 && (
              <span
                className={cn("text-xs font-medium", m.delta > 0 ? "text-success-ink" : "text-danger-ink")}
                style={MONO}
                title="Change on the previous period"
              >
                {m.delta > 0 ? "↑" : "↓"}
                {Math.abs(m.delta)}
              </span>
            )}
          </div>
          {m.hint && <p className="truncate text-xs text-muted-foreground">{m.hint}</p>}
        </div>
        {m.spark && <Sparkline data={m.spark} tone={m.sparkTone} />}
      </div>
    </div>
  );
}

export function MetricRail({
  metrics,
  isLoading,
  columns = 5,
}: {
  metrics: Metric[];
  isLoading?: boolean;
  columns?: 4 | 5;
}) {
  const grid = columns === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5";
  return (
    <div className={cn(PANEL, "grid gap-px overflow-hidden bg-border", grid)} aria-busy={isLoading || undefined}>
      {isLoading
        ? Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="bg-card px-4 py-3.5">
              <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
              <div className="mt-2.5 h-6 w-14 animate-pulse rounded bg-ink-100" />
            </div>
          ))
        : metrics.map((m) => <MetricCell key={m.label} m={m} />)}
    </div>
  );
}
