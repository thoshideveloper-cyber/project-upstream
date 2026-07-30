"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { TimeseriesPoint } from "@/hooks/use-analytics";

/**
 * Trend — deliberately TWO charts, never a dual axis. Volume (initial + follow-up,
 * stacked, on a counts axis) reads the effort; a slim replies strip (its own scale)
 * keeps the response signal legible even when it's a handful against hundreds of
 * emails — the exact failure of the old combined chart at low volume.
 */

const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
};

const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" };

export function TrendPanel({
  series,
  weeks,
  compact,
}: {
  series: TimeseriesPoint[];
  weeks: number;
  /** Shorter charts for a denser slot (e.g. the dashboard). */
  compact?: boolean;
}) {
  if (series.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No activity in this window.</p>;
  }

  const volH = compact ? 156 : 196;
  const repH = compact ? 88 : 120;

  const data = series.map((s) => ({
    label: s.label,
    initial: s.initial,
    followup: Math.max(0, s.sent - s.initial),
    responses: s.responses,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Emails sent · last {weeks} wks
          </span>
          <span className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: "var(--primary)" }} /> Initial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: "oklch(0.72 0.16 58 / 0.4)" }} /> Follow-up
            </span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={volH}>
          <BarChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -22 }} barCategoryGap="22%">
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            <Bar dataKey="initial" stackId="v" name="Initial" fill="var(--primary)" />
            <Bar dataKey="followup" stackId="v" name="Follow-up" fill="oklch(0.72 0.16 58 / 0.4)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: "oklch(0.65 0.18 152)" }} /> Replies / wk
        </div>
        <ResponsiveContainer width="100%" height={repH}>
          <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id="replyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.65 0.18 152)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.65 0.18 152)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--border)" }} />
            <Area type="monotone" dataKey="responses" name="Replies" stroke="oklch(0.65 0.18 152)" strokeWidth={2} fill="url(#replyFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
