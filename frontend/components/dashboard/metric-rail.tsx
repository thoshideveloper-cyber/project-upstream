"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useCounter } from "@/hooks/use-counter";

/** Compact inline sparkline (area + line), no chart lib. */
function Sparkline({ data, tone = "primary" }: { data: number[]; tone?: "primary" | "positive" }) {
  const w = 96;
  const h = 30;
  if (data.length < 2 || data.every((d) => d === 0)) {
    return (
      <svg width={w} height={h} className="opacity-40" aria-hidden>
        <line x1={0} y1={h - 4} x2={w} y2={h - 4} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="2 3" />
      </svg>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stroke = tone === "positive" ? "oklch(0.65 0.18 152)" : "var(--primary)";
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 3 - ((d - min) / span) * (h - 6);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  const gid = `spark-${tone}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={stroke} />
    </svg>
  );
}

export interface Metric {
  label: string;
  value: number | null;
  icon?: LucideIcon;
  isPercent?: boolean;
  hint?: string;
  delta?: number | null;
  spark?: number[];
  sparkTone?: "primary" | "positive";
}

function MetricTile({ m, style }: { m: Metric; style?: React.CSSProperties }) {
  const counted = useCounter(typeof m.value === "number" ? m.value : null);
  const shown = m.value === null ? "—" : m.isPercent ? `${counted ?? m.value}%` : counted ?? m.value;
  const Icon = m.icon;
  return (
    <div
      className="stat-card flex min-w-0 flex-col justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-border"
      style={style}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {m.label}
        </span>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {shown}
            </span>
            {m.delta != null && m.delta !== 0 && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  m.delta > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive-ink",
                )}
              >
                {m.delta > 0 ? "↑" : "↓"}
                {Math.abs(m.delta)}
              </span>
            )}
          </div>
          {m.hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.hint}</p>}
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
  if (isLoading) {
    return (
      <div className={cn("grid gap-4", grid)}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-4", grid)}>
      {metrics.map((m, i) => (
        <MetricTile key={m.label} m={m} style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}
