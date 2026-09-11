"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PanelEmpty } from "./states";

/**
 * Book composition — every project's companies split into the three states that
 * matter to a partner: replied, contacted-but-silent, and never emailed. One
 * horizontal stacked bar per project, so the eye reads *coverage* (how much of
 * the book has been worked) before it reads any rate.
 *
 * Replied is green — the one outcome that is good news; contacted-without-reply is
 * neutral ink (in flight, not yet a verdict); untouched is the palest grey.
 */

export const COMPOSITION_COLORS = {
  replied: "var(--success)",
  noReply: "var(--ink-400)",
  untouched: "var(--ink-100)",
} as const;

const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
  boxShadow: "var(--shadow-md)",
};

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

export interface CompositionRow {
  name: string;
  replied: number;
  noReply: number;
  untouched: number;
}

function LegendKey({ color, label, outlined }: { color: string; label: string; outlined?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-3 rounded-full"
        style={{ background: color, boxShadow: outlined ? "inset 0 0 0 1px var(--border-strong)" : undefined }}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function BookComposition({ rows }: { rows: CompositionRow[] }) {
  if (!rows.length) {
    return (
      <PanelEmpty
        line="No companies in any project book yet."
        cta="Open the Master List"
        href="/master"
      />
    );
  }

  // Enough room per row to breathe, but capped so ten projects don't push the
  // analyst table off the page.
  const height = Math.min(420, Math.max(140, rows.length * 46 + 24));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendKey color={COMPOSITION_COLORS.replied} label="Replied" />
        <LegendKey color={COMPOSITION_COLORS.noReply} label="Contacted, no reply" />
        <LegendKey color={COMPOSITION_COLORS.untouched} label="Never emailed" outlined />
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 4 }}
          barCategoryGap="30%"
        >
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={132}
            interval={0}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="replied" stackId="c" name="Replied" fill={COMPOSITION_COLORS.replied} />
          <Bar dataKey="noReply" stackId="c" name="Contacted, no reply" fill={COMPOSITION_COLORS.noReply} />
          <Bar
            dataKey="untouched"
            stackId="c"
            name="Never emailed"
            fill={COMPOSITION_COLORS.untouched}
            radius={[0, 2, 2, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
