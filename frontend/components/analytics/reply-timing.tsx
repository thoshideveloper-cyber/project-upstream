"use client";

import type { LatencyDimension, ReplyTiming } from "@/hooks/use-analytics";
import { MIN_N } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { MONO } from "@/lib/design";

/**
 * Reply timing — how long, and how many touches, a reply actually takes. Generalises
 * the per-company dossier BenchmarkStrip into two histograms + medians, always with
 * denominators. When the sample is thin (< MIN_N replies with timing) the whole panel
 * is recessed and captioned, never dressed as a confident distribution.
 *
 * The two histograms stack vertically (days over touches) so the panel reads as a tall
 * column beside the trend panel rather than two short charts leaving a void.
 */

function Histogram({ dim, unit }: { dim: LatencyDimension; unit: string }) {
  const max = Math.max(1, ...dim.buckets.map((b) => b.count));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {unit === "d" ? "Days to reply" : "Touches to reply"}
        </span>
        <span className="text-xs text-muted-foreground">
          median{" "}
          <span className="font-mono font-semibold tabular-nums text-foreground" style={MONO}>
            {dim.median == null ? "—" : `${dim.median}${unit === "d" ? "d" : ""}`}
          </span>
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {dim.buckets.map((b) => (
          <li key={b.label} className="flex items-center gap-2.5">
            <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground" style={MONO}>
              {b.label}
            </span>
            <div className="relative h-6 flex-1">
              <div className="absolute inset-0 rounded bg-muted/40" />
              <div
                className="absolute inset-y-0 left-0 rounded bg-primary/80 transition-[width] duration-700"
                style={{ width: `${b.count > 0 ? Math.max(4, (b.count / max) * 100) : 0}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground" style={MONO}>
              {b.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReplyTimingPanel({ data }: { data: ReplyTiming }) {
  const withData = data.days.with_data;
  const thin = withData > 0 && withData < MIN_N;

  if (withData === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          No timed replies yet — timing appears once replies land on emailed companies.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", thin && "opacity-70")}>
      <Histogram dim={data.days} unit="d" />
      <Histogram dim={data.touches} unit="t" />
      <p className="text-[11px] text-muted-foreground">
        {thin ? (
          <>
            Thin sample —{" "}
            <span className="font-mono tabular-nums" style={MONO}>
              {withData}
            </span>{" "}
            timed {withData === 1 ? "reply" : "replies"}. Read as a hint, not a rate.
          </>
        ) : (
          <>
            Across{" "}
            <span className="font-mono tabular-nums" style={MONO}>
              {withData}
            </span>{" "}
            timed replies, current cycle only.
          </>
        )}
      </p>
    </div>
  );
}
