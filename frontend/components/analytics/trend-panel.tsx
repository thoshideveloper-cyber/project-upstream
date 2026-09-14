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
 *
 * Effort is ink (initial solid, follow-ups lighter); replies are green, the one series
 * that is an outcome rather than an input.
 */

const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
  boxShadow: "var(--shadow-md)",
};

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

// The chart margins pull the plot left to reclaim recharts' default gutter, but -22
// against a 34px YAxis left only 12px for the ticks, so every two-digit label rendered
// as a sliver of its last glyph. -10 keeps the reclaim and lets the numbers through.

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
          <span className="text-xs font-medium text-muted-foreground">
            Emails sent, last {weeks} weeks
          </span>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full" style={{ background: "var(--primary)" }} /> Initial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full" style={{ background: "var(--ink-300)" }} /> Follow-up
            </span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={volH}>
          <BarChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -10 }} barCategoryGap="24%">
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="initial" stackId="v" name="Initial" fill="var(--primary)" />
            <Bar dataKey="followup" stackId="v" name="Follow-up" fill="var(--ink-300)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-2 w-3 rounded-full" style={{ background: "var(--success)" }} /> Replies per week
        </div>
        <ResponsiveContainer width="100%" height={repH}>
          <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -10 }}>
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--border-strong)" }} />
            <Area
              type="monotone"
              dataKey="responses"
              name="Replies"
              stroke="var(--success)"
              strokeWidth={1.75}
              fill="var(--success)"
              fillOpacity={0.08}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
