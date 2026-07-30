"use client";

import { useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PanelEmpty, PanelError } from "@/components/analytics/states";
import { MONO } from "@/lib/design";
import { Skeleton } from "@/components/ui/skeleton";
import { useMandates } from "@/hooks/use-mandates";
import { useFunnelAnalytics } from "@/hooks/use-funnel-analytics";
import { useDelayed } from "@/hooks/use-delayed";
import { isThin, MIN_N, pctLabel } from "@/lib/analytics";
import { dealLabel, ENGAGEMENT_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Sourcing analytics — the funnel's own read: how candidates move through the
 * stages, whether a stage converts, and whether the AI fit score predicts a
 * reply. Every rate ships its denominator and recesses below MIN_N, same as the
 * main analytics surfaces.
 */

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-border">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h2>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card p-4 text-center ring-1 ring-border">
      <div className="text-2xl font-semibold tabular-nums" style={MONO}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** A fit bucket vs its reply outcome — recessed when the sample is too thin. */
function FitCard({
  label,
  n,
  responded,
  rate,
}: {
  label: string;
  n: number;
  responded: number;
  rate: number;
}) {
  const thin = isThin(n);
  return (
    <div
      className={cn("rounded-lg border border-border p-3", thin && "opacity-60")}
      title={thin ? `Thin sample — fewer than ${MIN_N} placements` : undefined}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums" style={MONO}>
        {n > 0 ? pctLabel(rate) : "—"}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {responded}/{n} replied{thin && n > 0 ? " · thin" : ""}
      </div>
    </div>
  );
}

export default function SourcingAnalyticsPage() {
  const { data: mandates } = useMandates();
  const [mandateId, setMandateId] = useState<number>(0);
  const { data, isLoading, isError, refetch } = useFunnelAnalytics(mandateId || undefined);
  const showSkeleton = useDelayed(isLoading);

  const cov = data?.pool_coverage;
  const byStage = data?.by_stage ?? [];
  const respByStage = (data?.response_by_stage ?? []).filter((s) => s.placements > 0);
  const maxStage = Math.max(1, ...byStage.map((s) => s.count));
  const fit = data?.fit_vs_outcome;

  const loading = isLoading && showSkeleton;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sourcing analytics"
        description="Funnel conversion, reply rate by stage, pool coverage, and whether AI fit predicts a reply."
        actions={
          <Link href="/sourcing" className="text-sm text-primary-ink hover:underline">
            ← Workspace
          </Link>
        }
      />

      <select
        value={mandateId}
        onChange={(e) => setMandateId(Number(e.target.value))}
        aria-label="Filter by engagement"
        className="h-9 w-fit rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value={0}>All my engagements</option>
        {(mandates?.items ?? []).map((m) => {
          const l = dealLabel(m.client_name, m.name);
          return (
            <option key={m.id} value={m.id}>
              {l.secondary ? `${l.secondary} — ${l.primary}` : l.primary} ·{" "}
              {ENGAGEMENT_TYPE_LABEL[m.type]}
            </option>
          );
        })}
      </select>

      {isError ? (
        <Panel title="Sourcing analytics">
          <PanelError label="sourcing analytics" onRetry={() => refetch()} />
        </Panel>
      ) : loading ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-[88px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </>
      ) : isLoading ? null : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Pool total" value={cov?.pool_total ?? 0} />
            <Stat label="In a funnel" value={cov?.in_funnel ?? 0} />
            <Stat label="Scored" value={cov?.scored ?? 0} />
          </div>

          <Panel title="Funnel by stage" hint="Candidates currently sitting in each stage">
            {/* All-zero stages read as a broken chart, not as "empty" — say it plainly. */}
            {byStage.length === 0 || byStage.every((s) => s.count === 0) ? (
              <PanelEmpty
                line="No candidates in the funnel yet."
                cta="Open the sourcing workspace"
                href="/sourcing"
              />
            ) : (
              <div className="space-y-2">
                {byStage.map((s) => (
                  <div key={s.stage_name} className="flex items-center gap-3 text-sm">
                    <span className="w-40 shrink-0 truncate text-muted-foreground">
                      {s.stage_name}
                    </span>
                    <div className="h-4 flex-1 rounded bg-muted">
                      <div
                        className="h-4 rounded bg-primary/70"
                        style={{ width: `${(s.count / maxStage) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums" style={MONO}>
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Reply rate by stage" hint={`Rates over fewer than ${MIN_N} placements are recessed`}>
            {respByStage.length === 0 ? (
              <PanelEmpty line="No candidate from any stage has been placed into a book yet." />
            ) : (
              <div className="space-y-1 text-sm">
                {respByStage.map((s) => {
                  const thin = isThin(s.placements);
                  return (
                    <div
                      key={s.stage_name}
                      // Recess by colour, not alpha — alpha-dimmed figures fall
                      // under 4.5:1 exactly where the number is least trustworthy.
                      className={cn("flex justify-between", thin && "[&_*]:text-muted-foreground")}
                      title={thin ? `Thin sample — fewer than ${MIN_N} placements` : undefined}
                    >
                      <span className="text-muted-foreground">{s.stage_name}</span>
                      <span className="tabular-nums" style={MONO}>
                        {pctLabel(s.response_rate)}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({s.responded}/{s.placements})
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Does AI fit predict a reply?" hint="Placements split at a fit score of 60">
            {!fit || fit.high_fit.n + fit.low_fit.n === 0 ? (
              <PanelEmpty line="No scored candidate has been placed and worked yet." />
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <FitCard
                  label="High fit (≥60)"
                  n={fit.high_fit.n}
                  responded={fit.high_fit.responded}
                  rate={fit.high_fit.response_rate}
                />
                <FitCard
                  label="Low fit (<60)"
                  n={fit.low_fit.n}
                  responded={fit.low_fit.responded}
                  rate={fit.low_fit.response_rate}
                />
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
