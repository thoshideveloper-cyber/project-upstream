"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { AnalystRow } from "@/hooks/use-analytics";
import { cn } from "@/lib/utils";
import { pctLabel } from "@/lib/analytics";
import { MONO } from "@/lib/design";

/**
 * Analyst leaderboard (partner) — a LEAN, reply-focused ranking, deliberately NOT the
 * full six-column table that lives on Project health (we cross-link there instead of
 * re-rendering it). Top movers by initial emails, conversion with denominators shown.
 */

export function Leaderboard({ rows, loading }: { rows: AnalystRow[]; loading?: boolean }) {
  if (loading) return <div className="h-32 animate-pulse rounded-md bg-ink-100" />;

  const active = rows.filter((r) => r.emails_sent > 0).sort((a, b) => b.initial_emails - a.initial_emails);
  if (active.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">No analyst activity yet.</p>;

  const top = active.slice(0, 5);
  const maxConv = Math.max(0.01, ...top.map((r) => r.conversion_rate));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {top.map((r, i) => (
          <li key={r.user_id} className="flex items-center gap-3 py-1">
            <span className="w-4 shrink-0 text-right tabular-nums text-[11px] tabular-nums text-muted-foreground" style={MONO}>
              {i + 1}
            </span>
            <span className="w-36 shrink-0 truncate text-sm font-medium" title={r.full_name}>
              {r.full_name}
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums text-xs tabular-nums text-muted-foreground" style={MONO}>
              {r.initial_emails} sent
            </span>
            <div className="relative h-5 flex-1">
              <div className="absolute inset-0 rounded bg-muted/40" />
              <div
                className="absolute inset-y-0 left-0 flex items-center justify-end rounded bg-primary/80 pr-1.5 transition-[width] duration-700"
                style={{ width: `${Math.max(r.conversion_rate > 0 ? 8 : 0, (r.conversion_rate / maxConv) * 100)}%` }}
              >
                {r.conversion_rate > 0 && (
                  <span className="tabular-nums text-[10px] font-semibold tabular-nums" style={{ ...MONO, color: "var(--primary-foreground)" }}>
                    {pctLabel(r.conversion_rate)}
                  </span>
                )}
              </div>
            </div>
            <span className="w-12 shrink-0 text-right tabular-nums text-[11px] tabular-nums text-muted-foreground" style={MONO}>
              {r.responses}/{r.initial_emails}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border pt-2.5 text-[10px] text-muted-foreground">
        <span>conversion = replies ÷ initial emails</span>
        <Link href="/analytics/projects" className={cn("inline-flex items-center gap-0.5 font-medium text-primary-ink hover:underline")}>
          Full analyst breakdown
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
