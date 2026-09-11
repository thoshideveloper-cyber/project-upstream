"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Finding } from "@/lib/analytics";
import { PANEL } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * The Finding line — the page's computed thesis. The single highest-salience finding
 * leads as a sentence; up to two more ride underneath as drill-through links. Every
 * sentence is a deterministic re-read of real fields (see lib/analytics.ts), never a
 * prediction, and any rate it names carries its denominator.
 *
 * Tone is carried by a small state dot beside each sentence — red for something costing
 * time, green for something working — never by a coloured bar down the side.
 */

const TONE_DOT: Record<Finding["tone"], string> = {
  neutral: "bg-ink-300",
  positive: "bg-success",
  warning: "bg-danger",
};

const CTA_TONE: Record<Finding["tone"], string> = {
  neutral: "text-foreground",
  positive: "text-foreground",
  warning: "text-foreground",
};

function Chip({ f }: { f: Finding }) {
  const body = (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[f.tone])} aria-hidden />
      <span className="text-secondary-foreground">{f.text}</span>
      {f.cta && (
        <span className={cn("inline-flex items-center gap-0.5 font-medium", CTA_TONE[f.tone])}>
          {f.cta}
          <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </span>
  );
  const cls = "rounded-md bg-subtle px-2.5 py-1.5 text-xs ring-1 ring-inset ring-border transition-colors";
  return f.href ? (
    <Link href={f.href} className={cn(cls, "hover:bg-muted")}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

export function FindingLine({ findings, loading }: { findings: Finding[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className={cn(PANEL, "space-y-3 p-5")} aria-busy="true">
        <div className="h-6 w-3/4 animate-pulse rounded bg-ink-100" />
        <div className="flex gap-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-ink-100" />
          <div className="h-7 w-32 animate-pulse rounded-md bg-ink-100" />
        </div>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className={cn(PANEL, "p-5")}>
        <p className="text-base text-muted-foreground">Not enough outreach yet to read a trend.</p>
      </div>
    );
  }

  const [head, ...rest] = findings;
  const chips = rest.slice(0, 2);

  return (
    <div className={cn(PANEL, "flex flex-col gap-3 p-5")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="flex items-baseline gap-2 text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
          <span
            className={cn("relative top-[-2px] h-2 w-2 shrink-0 rounded-full", TONE_DOT[head.tone])}
            aria-hidden
          />
          {head.text}
        </p>
        {head.href && head.cta && (
          <Link
            href={head.href}
            className="group inline-flex items-center gap-0.5 text-sm font-medium text-foreground underline decoration-border-strong underline-offset-[3px] hover:decoration-foreground"
          >
            {head.cta}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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
  );
}
