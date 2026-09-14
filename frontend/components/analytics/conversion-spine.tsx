"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { contactedCount, repliedCount, interestedCount } from "@/lib/analytics";
import { MONO } from "@/lib/design";

/**
 * The Conversion Spine — the honest reframe of "response rate". The OUTREACH outcome
 * funnel (Contacted → Replied → Interested), distinct from the sourcing-stage funnel on
 * /sourcing/analytics. Built from overview.by_status (healthy-n: the whole book).
 *
 * Laid out as one ruled strip — three cells and the two step conversions between them —
 * rather than three cards inside a card. Each stage wears its status glyph, every stage
 * drills to the companies behind it, and the weakest step is marked red so the eye
 * lands on where outreach actually leaks.
 */

interface Stage {
  key: string;
  label: string;
  sub: string;
  value: number;
  dot: string; // status glyph
  bar: string; // proportional fill
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
      dot: "hb hb-25 hb-info",
      bar: "bg-info",
      href: "/master?view=firm-wide",
    },
    {
      key: "replied",
      label: "Replied",
      sub: "any response",
      value: replied,
      dot: "hb hb-50 hb-success",
      bar: "bg-success",
      href: "/master?view=firm-wide",
    },
    {
      key: "interested",
      label: "Interested",
      sub: "warm leads",
      value: interested,
      dot: "hb hb-100 hb-success",
      bar: "bg-success",
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
    <div className="flex flex-col items-stretch overflow-hidden rounded-lg ring-1 ring-border sm:flex-row">
      {stages.map((s, i) => {
        const pctOfContacted = contacted > 0 ? Math.round((s.value / contacted) * 100) : 0;
        return (
          <div key={s.key} className="contents">
            <Link
              href={s.href}
              className="group flex-1 bg-card p-4 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <div className="flex items-center gap-2">
                <span className={s.dot} aria-hidden />
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-semibold leading-8 tracking-[-0.01em] text-foreground" style={MONO}>
                  {s.value.toLocaleString()}
                </span>
                {i > 0 && (
                  <span className="text-xs text-muted-foreground" style={MONO}>
                    {pctOfContacted}% of contacted
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-300", s.bar)}
                  style={{ width: `${Math.max(s.value > 0 ? 4 : 0, (s.value / maxV) * 100)}%` }}
                />
              </div>
            </Link>

            {/* Connector — the step conversion, worst step marked. */}
            {i < stages.length - 1 && (
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center gap-1.5 border-y border-border px-3 py-2 sm:w-28 sm:flex-col sm:border-x sm:border-y-0 sm:py-0",
                  worstStep === i ? "bg-danger-soft" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-semibold",
                    worstStep === i ? "text-danger-ink" : "text-foreground",
                  )}
                  style={MONO}
                >
                  {Math.round(conv[i] * 100)}%
                </span>
                <ArrowRight
                  className={cn(
                    "h-3.5 w-3.5 rotate-90 sm:rotate-0",
                    worstStep === i ? "text-danger-ink" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                {worstStep === i && (
                  <span className="whitespace-nowrap text-xs font-medium text-danger-ink">
                    Biggest drop-off
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
