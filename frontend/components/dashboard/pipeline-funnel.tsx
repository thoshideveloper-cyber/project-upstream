"use client";

import { MONO } from "@/lib/design";
import { cn } from "@/lib/utils";

interface FunnelProps {
  byStatus: Record<string, number>;
  total: number;
}

/** Reply outcomes in their state colours: warm is green, closed grey, failed red. */
const OUTCOME = [
  { key: "INTERESTED", label: "Interested", cls: "bg-success" },
  { key: "RESPONDED", label: "Responded", cls: "bg-success-line" },
  { key: "DECLINED", label: "Declined", cls: "bg-ink-300" },
  { key: "BOUNCED", label: "Bounced", cls: "bg-danger" },
] as const;

/**
 * The firm's funnel, step by step: each stage as a bar against the sourced total, with
 * the conversion from the stage above printed beside it. Bars are ink — a stage count is
 * a magnitude, not a state — and only the outcome split underneath takes colour.
 */
export function PipelineFunnel({ byStatus, total }: FunnelProps) {
  const g = (k: string) => byStatus[k] ?? 0;
  const notContacted = g("NOT_CONTACTED");
  const contacted = total - notContacted;
  const replied = g("RESPONDED") + g("INTERESTED") + g("DECLINED");
  const interested = g("INTERESTED");

  const stages = [
    { label: "Sourced", value: total, sub: "on the master list" },
    { label: "Contacted", value: contacted, sub: "first outreach sent" },
    { label: "Replied", value: replied, sub: "any response" },
    { label: "Interested", value: interested, sub: "warm leads" },
  ];

  const repliedContacted = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;
  const outcomeTotal = OUTCOME.reduce((n, o) => n + g(o.key), 0);

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-3.5">
        {stages.map((s, i) => {
          const widthPct = total > 0 ? Math.max(s.value > 0 ? 2 : 0, (s.value / total) * 100) : 0;
          const convFromPrev =
            i === 0 ? null : stages[i - 1].value > 0 ? Math.round((s.value / stages[i - 1].value) * 100) : 0;
          return (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-foreground">
                  {s.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">{s.sub}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2" style={MONO}>
                  <span className="text-sm font-semibold text-foreground">{s.value.toLocaleString()}</span>
                  <span className="w-9 text-right text-xs text-muted-foreground">
                    {convFromPrev != null ? `${convFromPrev}%` : ""}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-300", i === 0 ? "bg-ink-300" : "bg-foreground")}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {/* Outcome split among everyone who replied or bounced */}
      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Reply outcomes</span>
          <span className="text-xs font-medium text-foreground" style={MONO}>
            {repliedContacted}% reply rate
          </span>
        </div>
        <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-ink-100">
          {OUTCOME.map((o) => {
            const v = g(o.key);
            const pct = outcomeTotal > 0 ? (v / outcomeTotal) * 100 : 0;
            return pct > 0 ? (
              <div key={o.key} className={o.cls} style={{ width: `${pct}%` }} title={`${o.label}: ${v}`} />
            ) : null;
          })}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {OUTCOME.map((o) => (
            <li key={o.key} className="flex items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", o.cls)} aria-hidden />
              <span className="text-muted-foreground">{o.label}</span>
              <span className="ml-auto font-medium text-foreground" style={MONO}>
                {g(o.key)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
