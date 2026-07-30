"use client";

import { cn } from "@/lib/utils";
import { useCounter } from "@/hooks/use-counter";

/**
 * Book tape — the analyst's book at a glance as a single instrument strip, not a
 * row of detached cards. Hairline-divided cells, mono numerals, quiet by design so
 * the desk briefing above keeps the spotlight.
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
  const w = 116;
  const h = 30;
  if (data.length < 2 || data.every((d) => d === 0)) {
    return (
      <svg width={w} height={h} className="opacity-30" aria-hidden>
        <line x1={0} y1={h - 3} x2={w} y2={h - 3} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="2 3" />
      </svg>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stroke = tone === "positive" ? "oklch(0.65 0.18 152)" : "var(--primary)";
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((d - min) / span) * (h - 5);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  const gid = `bt-spark-${tone}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={1.8} fill={stroke} />
    </svg>
  );
}

function Cell({ s }: { s: TapeStat }) {
  const counted = useCounter(typeof s.value === "number" ? s.value : null);
  const shown =
    s.value === null ? "—" : s.isPercent ? `${counted ?? s.value}%` : (counted ?? s.value).toLocaleString();
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.label}</span>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-semibold leading-none tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {shown}
            </span>
            {s.delta != null && s.delta !== 0 && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  s.delta > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive-ink",
                )}
              >
                {s.delta > 0 ? "↑" : "↓"}
                {Math.abs(s.delta)}
              </span>
            )}
          </div>
          {s.hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{s.hint}</p>}
        </div>
        {s.spark && <Sparkline data={s.spark} tone={s.sparkTone} />}
      </div>
    </div>
  );
}

export function BookTape({ stats, isLoading }: { stats: TapeStat[]; isLoading?: boolean }) {
  return (
    <div className="stat-card grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
      {isLoading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-4 sm:px-5">
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-2.5 h-6 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))
        : stats.map((s) => <Cell key={s.label} s={s} />)}
    </div>
  );
}
