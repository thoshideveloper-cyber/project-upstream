"use client";

import { cn } from "@/lib/utils";

interface FunnelProps {
  byStatus: Record<string, number>;
  total: number;
}

const OUTCOME = [
  { key: "INTERESTED", label: "Interested", color: "oklch(0.65 0.18 270)" },
  { key: "RESPONDED", label: "Responded", color: "oklch(0.65 0.18 152)" },
  { key: "DECLINED", label: "Declined", color: "var(--primary)" },
  { key: "BOUNCED", label: "Bounced", color: "var(--destructive)" },
] as const;

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
      <div className="flex flex-col gap-2.5">
        {stages.map((s, i) => {
          const widthPct = total > 0 ? Math.max(s.value > 0 ? 12 : 0, (s.value / total) * 100) : 0;
          const convFromPrev =
            i === 0 ? null : stages[i - 1].value > 0 ? Math.round((s.value / stages[i - 1].value) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-20 shrink-0 text-right">
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              </div>
              <div className="relative h-9 flex-1">
                <div className="absolute inset-0 rounded-md bg-muted/50" />
                <div
                  className="absolute inset-y-0 left-0 flex items-center rounded-md transition-[width] duration-700"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(90deg, oklch(0.72 0.16 58 / ${0.85 - i * 0.16}), oklch(0.72 0.16 58 / ${0.55 - i * 0.12}))`,
                  }}
                >
                  <span
                    className="pl-3 text-sm font-semibold tabular-nums text-primary-foreground mix-blend-normal"
                    style={{ fontFamily: "var(--font-mono)", color: "oklch(0.14 0.006 265)" }}
                  >
                    {s.value}
                  </span>
                </div>
              </div>
              <div className="w-11 shrink-0 text-right">
                {convFromPrev != null && (
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      convFromPrev >= 50 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {convFromPrev}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Outcome split among everyone contacted */}
      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Reply outcomes
          </span>
          <span className="font-mono text-xs tabular-nums text-foreground">{repliedContacted}% reply rate</span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {OUTCOME.map((o) => {
            const v = g(o.key);
            const pct = outcomeTotal > 0 ? (v / outcomeTotal) * 100 : 0;
            return pct > 0 ? (
              <div key={o.key} style={{ width: `${pct}%`, background: o.color }} title={`${o.label}: ${v}`} />
            ) : null;
          })}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {OUTCOME.map((o) => (
            <li key={o.key} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: o.color }} />
              <span className="text-muted-foreground">{o.label}</span>
              <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{g(o.key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
