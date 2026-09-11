"use client";

import type { SourceRow } from "@/hooks/use-analytics";
import { MIN_N, pctLabel } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { MONO } from "@/lib/design";

/**
 * Source × Quality — the 12-row table was really a 2-D relation, so it reads better
 * as a matrix. Each cell is a response rate on a single-hue amber ramp (magnitude),
 * carrying its own n. Cells below MIN_N are recessed (no fill, muted) so a 1/2 never
 * glows the same as a 6/20. Rows/cols are only rendered when the data has them.
 */

const QUALITY_COLS = ["HIGH", "MEDIUM", "LOW"] as const;
const QUALITY_LABEL: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function SourceQualityMatrix({ rows }: { rows: SourceRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No source data yet.</p>;
  }

  // Pivot into source → quality → cell.
  const cells = new Map<string, SourceRow>();
  const sources: string[] = [];
  let hasUnrated = false;
  for (const r of rows) {
    const src = r.source ?? "Unknown";
    if (!sources.includes(src)) sources.push(src);
    const q = r.source_quality ?? "UNRATED";
    if (q === "UNRATED") hasUnrated = true;
    cells.set(`${src}|${q}`, r);
  }
  const cols: string[] = [...QUALITY_COLS, ...(hasUnrated ? ["UNRATED"] : [])];

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-28 pb-1 text-left text-xs font-medium text-muted-foreground" />
              {cols.map((q) => (
                <th
                  key={q}
                  className="pb-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {q === "UNRATED" ? "Unrated" : QUALITY_LABEL[q]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((src) => (
              <tr key={src}>
                <td className="pr-2 text-xs font-medium text-foreground">{titleCase(src)}</td>
                {cols.map((q) => {
                  const cell = cells.get(`${src}|${q}`);
                  return (
                    <td key={q} className="p-0">
                      <Cell cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ramp legend */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>0%</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, var(--muted), var(--primary))" }} />
        <span>higher response rate</span>
        <span className="ml-2 inline-flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded border border-dashed border-border" />
          n&lt;{MIN_N}
        </span>
      </div>
    </div>
  );
}

function Cell({ cell }: { cell?: SourceRow }) {
  if (!cell || cell.total === 0) {
    return <div className="flex h-12 items-center justify-center rounded-md bg-muted/20 text-xs text-muted-foreground">—</div>;
  }
  const thin = cell.total < MIN_N;
  const intensity = 0.12 + Math.min(1, cell.response_rate) * 0.68;
  return (
    <div
      className={cn(
        "flex h-12 flex-col items-center justify-center rounded-md",
        thin && "border border-dashed border-border bg-transparent",
      )}
      // Ink density is the rate. Past the midpoint the cell is dark enough that its
      // figures flip to paper-white, so a strong source never hides its own number.
      style={thin ? undefined : { background: `oklch(0.17 0 0 / ${intensity})` }}
    >
      <span
        className={cn(
          "tabular-nums text-xs font-semibold tabular-nums",
          thin ? "text-muted-foreground" : intensity > 0.45 ? "text-background" : "text-foreground",
        )}
        style={MONO}
      >
        {pctLabel(cell.response_rate)}
      </span>
      <span
        className={cn(
          "tabular-nums text-[10px] tabular-nums",
          thin ? "text-muted-foreground" : intensity > 0.45 ? "text-background" : "text-foreground",
        )}
        style={MONO}
      >
        {cell.responded}/{cell.total}
      </span>
    </div>
  );
}
