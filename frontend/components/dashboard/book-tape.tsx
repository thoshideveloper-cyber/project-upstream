"use client";

import { MONO, PANEL } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * Book tape — the book at a glance as one ruled strip, not a row of detached cards.
 * Hairline-divided cells with tabular figures; quiet by design so the Today module
 * above keeps the spotlight.
 */

export interface TapeStat {
  label: string;
  value: number | null;
  isPercent?: boolean;
  delta?: number | null;
  hint?: string;
  spark?: number[];
  sparkTone?: "primary" | "positive";
}

function Sparkline({ data, tone = "primary" }: { data: number[]; tone?: "primary" | "positive" }) {
  const w = 96;
  const h = 28;
  if (data.length < 2 || data.every((d) => d === 0)) {
    return (
      <svg width={w} height={h} aria-hidden>
        <line x1={0} y1={h - 3} x2={w} y2={h - 3} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3" />
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

function Cell({ s }: { s: TapeStat }) {
  const shown =
    s.value === null ? "—" : s.isPercent ? `${s.value}%` : s.value.toLocaleString();
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5 sm:px-5">
      <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold leading-8 tracking-[-0.01em] text-foreground" style={MONO}>
              {shown}
            </span>
            {s.delta != null && s.delta !== 0 && (
              <span
                className={cn(
                  "text-xs font-medium",
                  s.delta > 0 ? "text-success-ink" : "text-danger-ink",
                )}
                style={MONO}
                title="Change on the previous week"
              >
                {s.delta > 0 ? "↑" : "↓"}
                {Math.abs(s.delta)}
              </span>
            )}
          </div>
          {s.hint && <p className="truncate text-xs text-muted-foreground">{s.hint}</p>}
        </div>
        {s.spark && <Sparkline data={s.spark} tone={s.sparkTone} />}
      </div>
    </div>
  );
}

export function BookTape({ stats, isLoading }: { stats: TapeStat[]; isLoading?: boolean }) {
  return (
    <div
      className={cn(
        PANEL,
        "grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3 lg:grid-cols-5",
      )}
    >
      {isLoading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card px-4 py-3.5 sm:px-5">
              <div className="h-3 w-16 animate-pulse rounded bg-ink-100" />
              <div className="mt-2.5 h-6 w-12 animate-pulse rounded bg-ink-100" />
            </div>
          ))
        : stats.map((s) => <Cell key={s.label} s={s} />)}
    </div>
  );
}
