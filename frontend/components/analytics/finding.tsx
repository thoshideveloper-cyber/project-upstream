"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Finding } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * The Finding line — the page's computed thesis. The single highest-salience
 * finding leads in the display serif; up to two more ride as drill-through chips.
 * Every sentence is a deterministic re-read of real fields (see lib/analytics.ts),
 * never a prediction, and any rate it names carries its denominator.
 */

const TONE_RULE: Record<Finding["tone"], string> = {
  neutral: "bg-primary/70",
  positive: "bg-emerald-500",
  warning: "bg-primary",
};

const CHIP_TONE: Record<Finding["tone"], string> = {
  neutral: "text-muted-foreground",
  positive: "text-emerald-700 dark:text-emerald-400",
  warning: "text-primary-ink",
};

function Chip({ f }: { f: Finding }) {
  const body = (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_RULE[f.tone])} aria-hidden />
      <span className="text-foreground/80">{f.text}</span>
      {f.cta && (
        <span className={cn("inline-flex items-center gap-0.5 font-medium", CHIP_TONE[f.tone])}>
          {f.cta}
          <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </span>
  );
  const cls =
    "rounded-full bg-muted/40 px-3 py-1.5 text-xs ring-1 ring-border transition-colors";
  return f.href ? (
    <Link href={f.href} className={cn(cls, "hover:bg-muted/70")}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

export function FindingLine({ findings, loading }: { findings: Finding[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-border">
        <div className="w-1 shrink-0 rounded-full bg-muted" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-7 w-40 animate-pulse rounded-full bg-muted" />
            <div className="h-7 w-32 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-border">
        <div className="w-1 shrink-0 rounded-full bg-muted-foreground/30" />
        <p className="self-center text-lg text-muted-foreground" style={{ fontFamily: "var(--font-display)" }}>
          Not enough outreach yet to read a trend.
        </p>
      </div>
    );
  }

  const [head, ...rest] = findings;
  const chips = rest.slice(0, 2);

  return (
    <div className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-border sm:p-6">
      <div className={cn("w-1 shrink-0 rounded-full", TONE_RULE[head.tone])} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p
            className="text-xl leading-snug text-foreground sm:text-2xl"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            {head.text}
          </p>
          {head.href && head.cta && (
            <Link
              href={head.href}
              className={cn("inline-flex items-center gap-0.5 text-sm font-medium", CHIP_TONE[head.tone])}
            >
              {head.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((f) => (
              <Chip key={f.id} f={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
