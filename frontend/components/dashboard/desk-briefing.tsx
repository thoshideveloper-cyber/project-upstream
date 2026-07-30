"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCounter } from "@/hooks/use-counter";
import { arcPath } from "./gauge-arc";

/**
 * Deal-desk briefing — the dashboard's signature. A computed morning brief laid out
 * as three instrument zones that fill the width: the THESIS (a serif verdict with the
 * figure in mono, since Cormorant breaks multi-digit numerals), the TRIAGE readout
 * (labelled load bars), and the PRESSURE dial (its centre reads the desk's *state*,
 * not a competing number). Boldness lives here; every other panel stays quiet.
 */

const GAUGE_START = -135;
const GAUGE_SWEEP = 270;

interface DeskBriefingProps {
  firmName?: string;
  analystName?: string;
  role?: string;
  overdue: number;
  dueToday: number;
  upcoming: number;
  needsInitial: number;
  dueThisWeek: number;
  isLoading?: boolean;
}

function istDate() {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Asia/Kolkata",
    }).format(new Date());
  } catch {
    return "";
  }
}

function PressureDial({ load, tone, word }: { load: number; tone: "danger" | "warn" | "calm"; word: string }) {
  const size = 176;
  const c = size / 2;
  const r = 66;
  const end = GAUGE_START + GAUGE_SWEEP * Math.max(0, Math.min(1, load));
  const stroke =
    tone === "danger" ? "var(--destructive)" : tone === "warn" ? "var(--primary)" : "oklch(0.65 0.18 152)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible" aria-hidden>
        {Array.from({ length: 28 }).map((_, i) => {
          const a = ((GAUGE_START + (GAUGE_SWEEP / 27) * i - 90) * Math.PI) / 180;
          const r1 = r + 11;
          const r2 = r + (i % 9 === 0 ? 17 : 14);
          const lit = i / 27 <= load;
          return (
            <line
              key={i}
              x1={c + r1 * Math.cos(a)}
              y1={c + r1 * Math.sin(a)}
              x2={c + r2 * Math.cos(a)}
              y2={c + r2 * Math.sin(a)}
              stroke={lit ? stroke : "var(--border)"}
              strokeWidth={i % 9 === 0 ? 1.5 : 1}
              opacity={lit ? 0.9 : 0.45}
            />
          );
        })}
        <path d={arcPath(c, c, r, GAUGE_START, GAUGE_START + GAUGE_SWEEP)} fill="none" stroke="var(--border)" strokeWidth={7} strokeLinecap="round" />
        {load > 0 && <path d={arcPath(c, c, r, GAUGE_START, end)} fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold uppercase tracking-[0.18em]" style={{ color: stroke, fontFamily: "var(--font-mono)" }}>
          {word}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">pressure</span>
      </div>
    </div>
  );
}

function LoadBar({ label, count, max, tone }: { label: string; count: number; max: number; tone: "danger" | "warn" | "calm" }) {
  const color = tone === "danger" ? "var(--destructive)" : tone === "warn" ? "var(--primary)" : "var(--muted-foreground)";
  const pct = max > 0 ? Math.max(count > 0 ? 5 : 0, (count / max) * 100) : 0;
  const numColor = count > 0 && tone !== "calm" ? color : "var(--foreground)";
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="w-8 shrink-0 text-right font-mono text-base font-semibold tabular-nums" style={{ color: numColor, fontFamily: "var(--font-mono)" }}>
        {count}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color, opacity: count > 0 ? 0.85 : 0 }} />
      </div>
    </div>
  );
}

export function DeskBriefing({
  firmName,
  analystName,
  role,
  overdue,
  dueToday,
  upcoming,
  needsInitial,
  dueThisWeek,
  isLoading,
}: DeskBriefingProps) {
  const attention = overdue + dueToday;
  const workload = attention + upcoming;
  const load = workload > 0 ? attention / workload : 0;
  const pressure = workload > 0 ? overdue / workload : 0;
  const maxBar = Math.max(overdue, dueToday, upcoming, 1);

  const tone: "danger" | "warn" | "calm" = attention === 0 ? "calm" : overdue > 0 && pressure >= 0.5 ? "danger" : "warn";
  const word = attention === 0 ? "clear" : overdue > 0 ? (pressure >= 0.5 ? "heavy" : "building") : "on deck";

  const heroNumber = overdue > 0 ? overdue : dueToday > 0 ? dueToday : 0;
  const counted = useCounter(heroNumber);
  const shownNumber = counted ?? heroNumber;
  const firstName = analystName?.split(" ")[0];

  const clause = overdue > 0 ? "follow-ups have slipped past due." : dueToday > 0 ? "follow-ups are due today." : "";
  const sub =
    overdue > 0
      ? `Clear the backlog before the day gets away${firstName ? `, ${firstName}` : ""}.`
      : dueToday > 0
        ? "Knock them out before they slip into the backlog."
        : dueThisWeek > 0
          ? `Nothing's slipped. ${dueThisWeek} follow-up${dueThisWeek === 1 ? "" : "s"} queued later this week.`
          : "Nothing's slipped and nothing's due. Go find your next target.";
  const heroTone = overdue > 0 ? "text-destructive-ink" : "text-primary-ink";
  const dateline = [firmName, istDate()].filter(Boolean).join("  ·  ").toUpperCase();

  return (
    <section
      className={cn("stat-card project-hero relative overflow-hidden rounded-xl bg-card ring-1 ring-border", overdue > 0 && "stat-card-overdue")}
      aria-label="Desk briefing"
    >
      <div className="relative p-6 sm:p-8">
        {/* Dateline */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{dateline}</span>
          {analystName && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {analystName} · {role ? role.toLowerCase() : ""}
            </span>
          )}
        </div>

        {/* Three instrument zones */}
        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">
          {/* Zone 1 — thesis */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {heroNumber > 0 && (
                <span className={cn("text-6xl font-semibold leading-none tabular-nums sm:text-7xl", heroTone)} style={{ fontFamily: "var(--font-mono)" }}>
                  {shownNumber}
                </span>
              )}
              <span className="text-2xl leading-tight text-foreground sm:text-[1.9rem]" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                {clause || "You’re clear."}
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">{sub}</p>
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
              <Link href="/schedule">
                <Button size="sm" variant={overdue > 0 ? "default" : "outline"} className="h-9">
                  {attention > 0 ? "Work the queue" : "Open the queue"}
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </Link>
              {needsInitial > 0 && (
                <Link href="/schedule" className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <span className="font-mono font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    {needsInitial}
                  </span>
                  need a first outreach
                  <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              )}
            </div>
          </div>

          {/* Zone 2 — triage readout */}
          <div className="flex w-full flex-col justify-center gap-3 border-t border-border pt-6 lg:w-80 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Work queue</span>
            <div className="flex flex-col gap-2.5">
              <LoadBar label="Overdue" count={overdue} max={maxBar} tone="danger" />
              <LoadBar label="Due today" count={dueToday} max={maxBar} tone="warn" />
              <LoadBar label="Upcoming" count={upcoming} max={maxBar} tone="calm" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-mono font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {attention}
              </span>{" "}
              to clear today
              {upcoming > 0 && (
                <>
                  {" · "}
                  <span className="font-mono tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{upcoming}</span> coming up
                </>
              )}
            </p>
          </div>

          {/* Zone 3 — pressure dial */}
          <div className="flex shrink-0 items-center justify-center border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <PressureDial load={load} tone={tone} word={word} />
          </div>
        </div>
      </div>
      {isLoading && <div className="absolute inset-0 animate-pulse bg-card/40" aria-hidden />}
    </section>
  );
}
