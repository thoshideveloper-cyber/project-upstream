"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { arcPath } from "./gauge-arc";

interface TriageCommandProps {
  overdue: number;
  dueToday: number;
  upcoming: number;
  needsInitial: number;
  isLoading?: boolean;
}

const GAUGE_START = -135;
const GAUGE_SWEEP = 270;

/** Backlog-pressure gauge: fraction of the near-term workload already overdue. */
function PressureGauge({ pressure, active }: { pressure: number; active: number }) {
  const size = 168;
  const c = size / 2;
  const r = 66;
  const end = GAUGE_START + GAUGE_SWEEP * pressure;
  // Color ramps amber → red as pressure climbs toward a redline.
  const hot = pressure >= 0.75;
  const stroke = hot ? "var(--destructive)" : "var(--primary)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Tick marks around the dial — instrument feel */}
        {Array.from({ length: 28 }).map((_, i) => {
          const a = ((GAUGE_START + (GAUGE_SWEEP / 27) * i - 90) * Math.PI) / 180;
          const r1 = r + 10;
          const r2 = r + (i % 9 === 0 ? 16 : 13);
          const lit = i / 27 <= pressure;
          return (
            <line
              key={i}
              x1={c + r1 * Math.cos(a)}
              y1={c + r1 * Math.sin(a)}
              x2={c + r2 * Math.cos(a)}
              y2={c + r2 * Math.sin(a)}
              stroke={lit ? stroke : "var(--border)"}
              strokeWidth={i % 9 === 0 ? 1.5 : 1}
              opacity={lit ? 0.9 : 0.5}
            />
          );
        })}
        {/* Track */}
        <path
          d={arcPath(c, c, r, GAUGE_START, GAUGE_START + GAUGE_SWEEP)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={7}
          strokeLinecap="round"
        />
        {/* Value */}
        {pressure > 0 && (
          <path
            d={arcPath(c, c, r, GAUGE_START, end)}
            fill="none"
            stroke={stroke}
            strokeWidth={7}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-semibold leading-none tabular-nums"
          style={{ fontVariantNumeric: "tabular-nums", color: hot ? "var(--destructive)" : "var(--foreground)" }}
        >
          {active}
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">
          to clear
        </span>
      </div>
    </div>
  );
}

interface SegProps {
  label: string;
  count: number;
  total: number;
  tone: "danger" | "warn" | "calm";
  emphasize?: boolean;
}

const TONE = {
  danger: { dot: "var(--destructive)", bar: "var(--destructive)" },
  warn: { dot: "var(--primary)", bar: "var(--primary)" },
  calm: { dot: "var(--muted-foreground)", bar: "var(--muted-foreground)" },
} as const;

function Segment({ label, count, total, tone, emphasize }: SegProps) {
  const t = TONE[tone];
  const pct = total > 0 ? Math.max(count > 0 ? 4 : 0, (count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.dot }} aria-hidden />
      <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span
        className={cn("w-10 shrink-0 text-right text-lg tabular-nums", emphasize ? "font-semibold" : "font-medium")}
        style={{ fontVariantNumeric: "tabular-nums", color: count > 0 && tone !== "calm" ? t.dot : "var(--foreground)" }}
      >
        {count}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: t.bar, opacity: count > 0 ? 0.85 : 0 }}
        />
      </div>
    </div>
  );
}

export function TriageCommand({
  overdue,
  dueToday,
  upcoming,
  needsInitial,
  isLoading,
}: TriageCommandProps) {
  const attention = overdue + dueToday;
  const workload = overdue + dueToday + upcoming;
  const pressure = workload > 0 ? overdue / workload : 0;
  const max = Math.max(overdue, dueToday, upcoming, 1);

  const situation =
    workload === 0
      ? "Queue is clear — nothing needs a touch right now."
      : overdue > 0
        ? `${overdue} follow-up${overdue === 1 ? "" : "s"} slipped past due. Clear the backlog first.`
        : dueToday > 0
          ? `${dueToday} due today — knock them out before they slip.`
          : "Nothing overdue. Stay ahead of what's coming.";

  return (
    <section
      className={cn(
        "stat-card relative overflow-hidden rounded-lg bg-card ring-1 ring-border",
        overdue > 0 && "stat-card-overdue",
      )}
      aria-label="Work queue triage"
    >
      <div className="relative flex flex-col gap-6 p-5 lg:flex-row lg:items-center lg:gap-8 lg:p-6">
        {/* Left: gauge */}
        <div className="flex items-center gap-5">
          <PressureGauge pressure={pressure} active={attention} />
          <div className="lg:hidden">
            <p className="text-xs font-medium text-muted-foreground">
              Work queue
            </p>
          </div>
        </div>

        {/* Middle: triage readouts */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 hidden items-center justify-between lg:flex">
            <p className="text-xs font-medium text-muted-foreground">
              Work queue · triage
            </p>
            <span className="tabular-nums text-[11px] tabular-nums text-muted-foreground">
              {workload} in window
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <Segment label="Overdue" count={overdue} total={max} tone="danger" emphasize />
            <Segment label="Due today" count={dueToday} total={max} tone="warn" />
            <Segment label="Upcoming" count={upcoming} total={max} tone="calm" />
          </div>
        </div>

        {/* Right: situation + actions */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="text-sm leading-snug text-secondary-foreground">{situation}</p>
          <div className="flex flex-col gap-2">
            <Link href="/schedule" className="w-full">
              <Button size="sm" variant={overdue > 0 ? "default" : "outline"} className="w-full justify-between">
                Work the queue
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
            {needsInitial > 0 && (
              <Link
                href="/schedule"
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="size-3.5" />
                <span className="tabular-nums text-foreground">{needsInitial}</span>
                need a first outreach
              </Link>
            )}
          </div>
        </div>
      </div>
      {isLoading && <div className="absolute inset-0 animate-pulse bg-card/40" aria-hidden />}
    </section>
  );
}
