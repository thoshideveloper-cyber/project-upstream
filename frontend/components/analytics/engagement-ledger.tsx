"use client";

import Link from "next/link";
import { AlertTriangle, Mail, ArrowRight } from "lucide-react";

import type { EngagementRow } from "@/hooks/use-analytics";
import type { MandateType } from "@/types";
import { cn } from "@/lib/utils";
import { pctLabel } from "@/lib/analytics";
import { DEAL_TYPE_STYLE, DEAL_TYPE_SHORT, MONO } from "@/lib/design";

/**
 * Engagement ledger — the per-deal rollup, now speaking the app's colour language
 * (deal-type hues) and no longer a dead end. Volume, replies with denominators, and
 * (for partners, from project health) the overdue / needs-first counts that make a
 * row worth clicking. Every row drills to the work: the queue scoped to that deal.
 */

export interface EngagementHealth {
  projectId: number;
  overdue: number;
  needsFirst: number;
}

export function EngagementLedger({
  rows,
  health,
  loading,
}: {
  rows: EngagementRow[];
  /** mandate_id → health, when available (partner via project analytics). */
  health?: Map<number, EngagementHealth>;
  loading?: boolean;
}) {
  if (loading) return <div className="h-40 animate-pulse rounded-md bg-ink-100" />;
  if (rows.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">No engagement activity yet.</p>;

  const maxSent = Math.max(1, ...rows.map((r) => r.emails_sent));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th className="pb-2 text-left">Engagement</th>
            <th className="min-w-40 pb-2 text-left">Emails sent</th>
            <th className="pb-2 text-right">Replies</th>
            <th className="hidden pb-2 text-right sm:table-cell">Bounced</th>
            <th className="pb-2 text-right">Attention</th>
            <th className="pb-2 text-right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => {
            const h = health?.get(r.mandate_id);
            return (
              <tr
                key={r.mandate_id}
                className="data-row transition-colors hover:bg-subtle"
                style={{ ["--row-i" as string]: i }}
              >
                <td className="py-2.5 pr-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
                        DEAL_TYPE_STYLE[r.type as MandateType],
                      )}
                    >
                      {DEAL_TYPE_SHORT[r.type as MandateType] ?? r.type}
                    </span>
                    <Link
                      href={`/schedule?deal=${r.mandate_id}`}
                      className="truncate font-medium hover:underline"
                      title={r.name}
                    >
                      {r.name}
                    </Link>
                    <span className="shrink-0 text-[11px] text-muted-foreground">· {r.total_companies} cos</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/50"
                        style={{ width: `${(r.emails_sent / maxSent) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums text-xs tabular-nums text-muted-foreground" style={MONO}>
                      {r.emails_sent}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <span className="tabular-nums text-sm font-medium tabular-nums text-foreground" style={MONO}>
                    {pctLabel(r.response_rate)}
                  </span>{" "}
                  <span className="tabular-nums text-[11px] tabular-nums text-muted-foreground" style={MONO}>
                    {r.responded}/{r.total_companies}
                  </span>
                </td>
                <td className="hidden py-2.5 text-right sm:table-cell">
                  <span
                    className={cn(
                      "tabular-nums text-xs tabular-nums",
                      r.bounced > 0 ? "text-destructive-ink" : "text-muted-foreground",
                    )}
                    style={MONO}
                  >
                    {r.bounced}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {h && h.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-ink" title="overdue a follow-up">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="tabular-nums" style={MONO}>{h.overdue}</span>
                      </span>
                    )}
                    {h && h.needsFirst > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="never emailed">
                        <Mail className="h-3 w-3" />
                        <span className="tabular-nums" style={MONO}>{h.needsFirst}</span>
                      </span>
                    )}
                    {(!h || (h.overdue === 0 && h.needsFirst === 0)) && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 pl-3 text-right">
                  {h ? (
                    <Link
                      href={`/projects/${h.projectId}?book=${r.mandate_id}`}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-ink hover:underline"
                    >
                      Health
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <Link
                      href={`/schedule?deal=${r.mandate_id}`}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-ink hover:underline"
                    >
                      Queue
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
