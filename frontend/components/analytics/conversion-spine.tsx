"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { contactedCount, repliedCount, interestedCount } from "@/lib/analytics";
import { MONO } from "@/lib/design";

/**
 * The Conversion Spine — the page's one bold instrument, and the honest reframe of
 * "response rate". The OUTREACH outcome funnel (Contacted → Replied → Interested),
 * distinct from the sourcing-stage funnel on /sourcing/analytics. Built from
 * overview.by_status (healthy-n: the whole book), painted in the status-dot colours,
 * every stage drilling to the companies behind it, and the weakest step flagged so
 * the eye lands on where outreach actually leaks.
 */

interface Stage {
  key: string;
  label: string;
  sub: string;
  value: number;
  dot: string; // Tailwind bg for the status dot
  bar: string; // Tailwind bg for the proportional fill
  href: string;
}

export function ConversionSpine({
  byStatus,
  total,
}: {
  byStatus: Record<string, number>;
  total: number;
}) {
  const contacted = contactedCount(byStatus, total);
  const replied = repliedCount(byStatus);
  const interested = interestedCount(byStatus);

  const stages: Stage[] = [
    {
      key: "contacted",
      label: "Contacted",
      sub: "first email sent",
      value: contacted,
      dot: "bg-sky-500",
      bar: "bg-sky-500/70",
      href: "/master?view=firm-wide",
    },
    {
      key: "replied",
      label: "Replied",
      sub: "any response",
      value: replied,
      dot: "bg-emerald-500",
      bar: "bg-emerald-500/70",
      href: "/master?view=firm-wide",
    },
    {
      key: "interested",
      label: "Interested",
      sub: "warm leads",
      value: interested,
      dot: "bg-violet-500",
      bar: "bg-violet-500/70",
      href: "/master?view=firm-wide&status=INTERESTED",
    },
  ];

  if (contacted === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No outreach logged yet — the funnel fills as first emails go out.
      </p>
    );
  }

  // Step conversions (from the prior stage); the minimum is the biggest drop-off.
  const conv = [
    stages[0].value > 0 ? stages[1].value / stages[0].value : 0,
    stages[1].value > 0 ? stages[2].value / stages[1].value : 0,
  ];
  const worstStep = conv[0] <= conv[1] ? 0 : 1;

  const maxV = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="flex flex-col gap-6">
      {/* Stage flow — horizontal on desktop, stacked on mobile */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {stages.map((s, i) => {
          const pctOfContacted = contacted > 0 ? Math.round((s.value / contacted) * 100) : 0;
          return (
            <div key={s.key} className="contents">
              <Link
                href={s.href}
                className="group flex-1 rounded-xl bg-muted/30 p-4 ring-1 ring-border transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} aria-hidden />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {s.label}
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums text-foreground" style={MONO}>
                    {s.value}
                  </span>
                  {i > 0 && (
                    <span className="text-xs tabular-nums text-muted-foreground" style={MONO}>
                      {pctOfContacted}% of contacted
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.sub}</p>
                {/* Proportional fill */}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-700", s.bar)}
                    style={{ width: `${Math.max(s.value > 0 ? 6 : 0, (s.value / maxV) * 100)}%` }}
                  />
                </div>
              </Link>

              {/* Connector — step conversion, worst step flagged */}
              {i < stages.length - 1 && (
                <div className="flex shrink-0 flex-row items-center justify-center gap-1 px-1 sm:flex-col">
                  <span
                    className={cn(
                      "font-mono text-xs font-semibold tabular-nums",
                      worstStep === i ? "text-primary-ink" : "text-muted-foreground",
                    )}
                  >
                    {Math.round(conv[i] * 100)}%
                  </span>
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 rotate-90 sm:rotate-0",
                      worstStep === i ? "text-primary-ink" : "text-muted-foreground",
                    )}
                  />
                  {worstStep === i && (
                    <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-ink">
                      biggest drop-off
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
