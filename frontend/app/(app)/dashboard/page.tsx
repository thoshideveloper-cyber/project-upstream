"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight, TrendingUp, Clock, Filter, Tag, Layers } from "lucide-react";

import {
  useAnalyticsOverview,
  useResponseByCategory,
  useTimeseries,
  type CategoryRow,
} from "@/hooks/use-analytics";
import { useDue, type ScheduleRow } from "@/hooks/use-schedule";
import { useMandates } from "@/hooks/use-mandates";
import { useAuth } from "@/hooks/use-auth";
import {
  contactedCount,
  repliedCount,
  replyRate,
  periodTrend,
  partitionRates,
  pctLabel,
  type RateRow,
} from "@/lib/analytics";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { Button } from "@/components/ui/button";
import { DeskBriefing } from "@/components/dashboard/desk-briefing";
import { BookTape, type TapeStat } from "@/components/dashboard/book-tape";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { useDelayed } from "@/hooks/use-delayed";
import { Section } from "@/components/dashboard/section";
import { TrendPanel } from "@/components/analytics/trend-panel";
import { PanelError } from "@/components/analytics/states";
import { DEAL_TYPE_STYLE, DEAL_TYPE_SHORT, MONO } from "@/lib/design";
import { dealLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MandateType } from "@/types";

interface FocusDeal {
  type: MandateType;
  name: string;
}

/** A single triage row in Today's focus — laid out as aligned work-queue columns:
 *  an urgency rail, the company (flagged when it's a first-ever email), which deal,
 *  who to email, and the overdue age (with backlog heat), plus a one-tap log. */
function FocusRow({
  row,
  deal,
  index,
  maxOverdue,
}: {
  row: ScheduleRow;
  deal?: FocusDeal;
  index: number;
  maxOverdue: number;
}) {
  const overdue = row.is_overdue;
  const age = Math.abs(row.days_remaining ?? 0);
  const contact = row.primary_contact?.name;
  // Age heat: the deeper the backlog, the hotter the label reads. The floor is
  // 0.85, not 0.55 — below that the red label fell under 4.5:1 and the youngest
  // overdue rows were the hardest to read, which is backwards.
  const heat = overdue && maxOverdue > 0 ? 0.85 + (age / maxOverdue) * 0.15 : 1;

  return (
    <li
      className="data-row group flex items-stretch gap-3 pr-4 transition-colors hover:bg-primary/[0.035]"
      style={{ ["--row-i" as string]: index }}
    >
      <span
        className={cn("w-[3px] shrink-0 rounded-full", overdue ? "bg-destructive" : "bg-primary")}
        style={{ opacity: overdue ? heat : 0.9 }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 items-center gap-3 py-3 sm:gap-4">
        {/* Company (first-email rows get a quiet flag, since they need different handling) */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link href={`/companies/${row.company_id}`} className="truncate text-sm font-medium hover:underline">
            {row.company_name}
          </Link>
          {row.schedule_status === "AWAITING_INITIAL" && (
            <span className="hidden shrink-0 rounded bg-primary/12 px-1.5 py-px text-[10px] font-medium text-primary-ink sm:inline">
              First email
            </span>
          )}
        </div>

        {/* Deal + contact — aligned right columns */}
        <div className="hidden w-36 shrink-0 items-center gap-1.5 lg:flex xl:w-44">
          {deal && (
            <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-medium", DEAL_TYPE_STYLE[deal.type])}>
              {DEAL_TYPE_SHORT[deal.type]}
            </span>
          )}
          {deal?.name && (
            <span className="truncate text-xs text-muted-foreground" title={deal.name}>
              {deal.name}
            </span>
          )}
        </div>
        <span className="hidden w-36 shrink-0 truncate text-xs text-muted-foreground md:inline" title={contact ?? undefined}>
          {contact ? `→ ${contact}` : "—"}
        </span>

        {/* Overdue age */}
        <span
          className="w-24 shrink-0 text-right font-mono text-xs tabular-nums"
          style={{
            ...MONO,
            color: overdue ? "var(--destructive-ink)" : "var(--muted-foreground)",
            opacity: overdue ? heat : 1,
            fontWeight: overdue ? 500 : 400,
          }}
        >
          {overdue ? `${age}d overdue` : "due today"}
        </span>

        <LogOutreachDialog
          companyId={row.company_id}
          companyName={row.company_name}
          defaultEventType={row.schedule_status === "AWAITING_INITIAL" ? "INITIAL_EMAIL" : "FOLLOW_UP"}
          trigger={
            <Button size="sm" variant={overdue ? "destructive" : "outline"} className="h-7 shrink-0 text-xs">
              Log
            </Button>
          }
        />
      </div>
    </li>
  );
}

/** Response rate by category — low-n aware: denominators shown, thin buckets recessed
 *  and excluded from the ranking, above-benchmark reads amber. Rows drill to the grid. */
function CategoryLanding({
  rows,
  benchmark,
  loading,
}: {
  rows: CategoryRow[];
  benchmark: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  const rateRows = rows.map((c) => ({
    label: c.category,
    total: c.total,
    responded: c.responded,
    rate: c.response_rate,
    href: c.category_id ? `/master?view=firm-wide&category_id=${c.category_id}` : undefined,
  }));
  const { ranked, thin } = partitionRates(rateRows);

  if (ranked.length === 0 && thin.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No category data yet.</p>;
  }

  const maxRate = Math.max(0.01, benchmark, ...ranked.map((r) => r.rate));

  const Bar = ({ r, thin: isThin }: { r: RateRow; thin?: boolean }) => {
    const above = !isThin && r.rate >= benchmark && r.rate > 0;
    const inner = (
      <>
        <span className={cn("w-24 shrink-0 truncate text-xs", isThin ? "text-muted-foreground" : "text-foreground")} title={r.label}>
          {r.label}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", above ? "bg-primary" : "bg-muted-foreground/30")}
            style={{ width: `${Math.max(r.rate > 0 ? 4 : 0, (r.rate / maxRate) * 100)}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground" style={MONO}>
          <span className={cn(!isThin && "text-foreground")}>{pctLabel(r.rate)}</span> {r.responded}/{r.total}
        </span>
      </>
    );
    return r.href && !isThin ? (
      <Link href={r.href} className="flex items-center gap-3 rounded-md transition-colors hover:bg-primary/[0.04]">
        {inner}
      </Link>
    ) : (
      <div className="flex items-center gap-3">{inner}</div>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-widest">Ranked by response rate</span>
        <span>firm avg {pctLabel(benchmark)}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {ranked.slice(0, 6).map((r) => (
          <li key={r.label}>
            <Bar r={r} />
          </li>
        ))}
        {thin.length > 0 && (
          <>
            <li className="flex items-center gap-2 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-px flex-1 bg-border/60" />
              thin data · n&lt;5
              <span className="h-px flex-1 bg-border/60" />
            </li>
            {thin.slice(0, 3).map((r) => (
              <li key={r.label}>
                <Bar r={r} thin />
              </li>
            ))}
          </>
        )}
      </ul>
      <div className="mt-1 flex items-center gap-4 border-t border-border pt-2.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> at / above avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/30" /> below avg
        </span>
        <span className="ml-auto">responded / total →</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const overviewQ = useAnalyticsOverview();
  const categoriesQ = useResponseByCategory();
  const dueQ = useDue(7);
  const tsQ = useTimeseries(12);
  const { data: mandates } = useMandates();
  const { user } = useAuth();

  // Only surface placeholders once the wait actually passes 300ms.
  const slowDue = useDelayed(!dueQ.data && dueQ.isLoading);
  const slowOverview = useDelayed(overviewQ.isLoading && !overviewQ.data);
  const slowCategories = useDelayed(categoriesQ.isLoading);

  const overview = overviewQ.data;

  const dealById = new Map<number, FocusDeal>(
    (mandates?.items ?? []).map((m) => {
      const l = dealLabel(m.client_name, m.name);
      return [m.id, { type: m.type, name: l.secondary || l.primary }];
    }),
  );

  const dueItems = dueQ.data?.items ?? [];
  const counts = dueQ.data?.counts;
  const overdueRows = dueItems
    .filter((r) => r.is_overdue)
    .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));
  const dueTodayRows = dueItems.filter((r) => !r.is_overdue && r.days_remaining === 0);
  const focusRows = [...overdueRows, ...dueTodayRows];
  const maxOverdue = Math.max(1, ...overdueRows.map((r) => Math.abs(r.days_remaining ?? 0)));

  // Backlog concentration — analysts work outreach by deal, so if the backlog clusters
  // in one engagement, surface it as a batchable action (honest count over the full set).
  const overdueByMandate = new Map<number, number>();
  for (const r of overdueRows) overdueByMandate.set(r.mandate_id, (overdueByMandate.get(r.mandate_id) ?? 0) + 1);
  let topMandateId = -1;
  let topMandateCount = 0;
  overdueByMandate.forEach((count, id) => {
    if (count > topMandateCount) {
      topMandateCount = count;
      topMandateId = id;
    }
  });
  const topDeal = topMandateId >= 0 ? dealById.get(topMandateId) : undefined;
  const concentrated =
    topDeal && topMandateCount >= 3 && overdueRows.length > 0 && topMandateCount / overdueRows.length >= 0.3;

  const series = tsQ.data?.items ?? [];
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const sentWeek = last?.sent ?? 0;
  const respWeek = last?.responses ?? 0;
  const sentDelta = last && prev ? last.sent - prev.sent : null;
  const respDelta = last && prev ? last.responses - prev.responses : null;

  const byStatus = overview?.by_status ?? {};
  const contacted = contactedCount(byStatus, overview?.total ?? 0);
  const replied = repliedCount(byStatus);
  const rate = replyRate(contacted, replied);
  const trend = periodTrend(series);
  const rateDelta = trend.comparable ? trend.deltaPts : null;

  const stats: TapeStat[] = [
    {
      label: "Companies",
      value: overview?.total ?? null,
      hint: overview ? `${overview.active_mandates} active engagements` : undefined,
    },
    {
      label: "Emails / wk",
      value: tsQ.data ? sentWeek : null,
      delta: sentDelta,
      spark: series.map((s) => s.sent),
    },
    {
      label: "Replies / wk",
      value: tsQ.data ? respWeek : null,
      delta: respDelta,
      spark: series.map((s) => s.responses),
      sparkTone: "positive",
    },
    {
      label: "Reply rate",
      value: overview ? Math.round(rate * 100) : null,
      isPercent: true,
      hint: overview ? `${replied} of ${contacted} contacted` : undefined,
      delta: rateDelta,
    },
    {
      label: "Needs first",
      value: overview?.needs_initial ?? null,
      hint: overview?.needs_initial ? "awaiting a first email" : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Signature: the deal-desk briefing */}
      <DeskBriefing
        firmName={user?.firm?.name}
        analystName={user?.full_name}
        role={user?.role}
        overdue={counts?.overdue ?? overdueRows.length}
        dueToday={counts?.due_today ?? dueTodayRows.length}
        upcoming={counts?.upcoming ?? 0}
        needsInitial={overview?.needs_initial ?? 0}
        dueThisWeek={overview?.due_this_week ?? 0}
        isLoading={slowDue}
      />

      {/* Book at a glance */}
      <div style={{ animationDelay: "70ms" }} className="stat-card">
        <BookTape stats={stats} isLoading={slowOverview} />
      </div>

      {/* Today's focus + sourcing pipeline */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Section
          className="hover-lift lg:col-span-7"
          style={{ animationDelay: "140ms" }}
          title="Today's focus"
          icon={<Clock className="h-3.5 w-3.5 text-primary-ink" />}
          badge={
            focusRows.length > 0 ? (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground" style={MONO}>
                {overdueRows.length} overdue · {dueTodayRows.length} today
              </span>
            ) : undefined
          }
          action={
            <Link href="/schedule" className="group flex items-center gap-1 text-xs text-primary-ink hover:underline">
              Full work queue
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
          flush
        >
          {dueQ.isError ? (
            <PanelError label="your queue" onRetry={() => dueQ.refetch()} />
          ) : focusRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              <p className="text-sm font-medium">You&rsquo;re all caught up.</p>
              <p className="text-xs text-muted-foreground">
                {overview?.due_this_week
                  ? `${overview.due_this_week} follow-up${overview.due_this_week === 1 ? "" : "s"} due later this week.`
                  : "No follow-ups due this week."}
              </p>
            </div>
          ) : (
            <>
              {concentrated && topDeal && (
                <Link
                  href={`/schedule?deal=${topMandateId}`}
                  className="group flex items-center gap-2 border-b border-border bg-primary/[0.04] px-4 py-2.5 text-xs transition-colors hover:bg-primary/[0.08]"
                >
                  <Layers className="h-3.5 w-3.5 shrink-0 text-primary-ink" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    <span className="font-mono font-semibold tabular-nums text-foreground" style={MONO}>
                      {topMandateCount}
                    </span>{" "}
                    of your {overdueRows.length} overdue are{" "}
                    <span className="font-medium text-foreground">{topDeal.name}</span> — batch them in one pass.
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary-ink">
                    Work deal
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              )}
              <ul className="flex flex-col divide-y divide-border">
                {focusRows.slice(0, 8).map((row, i) => (
                  <FocusRow
                    key={row.company_id}
                    row={row}
                    deal={dealById.get(row.mandate_id)}
                    index={i}
                    maxOverdue={maxOverdue}
                  />
                ))}
              </ul>
              {focusRows.length > 8 && (
                <Link
                  href="/schedule"
                  className="group flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="font-mono tabular-nums" style={MONO}>
                    {focusRows.length - 8}
                  </span>
                  more to clear
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </>
          )}
        </Section>

        <Section
          className="hover-lift lg:col-span-5"
          style={{ animationDelay: "200ms" }}
          title="Sourcing pipeline"
          icon={<Filter className="h-3.5 w-3.5 text-primary-ink" />}
          action={
            <Link href="/master" className="group flex items-center gap-1 text-xs text-primary-ink hover:underline">
              Master list
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        >
          {overviewQ.isError ? (
            <PanelError label="the pipeline" onRetry={() => overviewQ.refetch()} />
          ) : overview ? (
            <PipelineFunnel byStatus={byStatus} total={overview.total} />
          ) : (
            <div className="h-56 animate-pulse rounded-md bg-muted" />
          )}
        </Section>
      </div>

      {/* Trend + response by category */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Section
          className="hover-lift lg:col-span-7"
          style={{ animationDelay: "260ms" }}
          title="Volume & replies · last 12 weeks"
          icon={<TrendingUp className="h-3.5 w-3.5 text-primary-ink" />}
          action={
            <Link href="/analytics" className="group flex items-center gap-1 text-xs text-primary-ink hover:underline">
              Analytics
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        >
          {tsQ.isError ? (
            <PanelError label="the trend" onRetry={() => tsQ.refetch()} />
          ) : (
            <TrendPanel series={series} weeks={12} compact />
          )}
        </Section>

        <Section
          className="hover-lift lg:col-span-5"
          style={{ animationDelay: "320ms" }}
          title="Response rate by category"
          icon={<Tag className="h-3.5 w-3.5 text-primary-ink" />}
        >
          {categoriesQ.isError ? (
            <PanelError label="categories" onRetry={() => categoriesQ.refetch()} />
          ) : (
            <CategoryLanding
              rows={categoriesQ.data?.items ?? []}
              benchmark={overview?.responded_pct ?? 0}
              loading={slowCategories}
            />
          )}
        </Section>
      </div>
    </div>
  );
}
