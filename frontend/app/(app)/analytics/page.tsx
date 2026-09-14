"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Send,
  CheckCircle2,
  MailX,
  Sparkles,
  TrendingUp,
  GitBranchPlus,
  Timer,
  Grid3x3,
  Layers,
  Users,
  ArrowRight,
} from "lucide-react";

import {
  useAnalyticsOverview,
  useResponseByCategory,
  useResponseByLayer,
  useByAnalyst,
  useByEngagement,
  useSources,
  useTimeseries,
  useReplyTiming,
  useProjectAnalytics,
} from "@/hooks/use-analytics";
import { useAuth } from "@/hooks/use-auth";
import {
  buildFindings,
  contactedCount,
  repliedCount,
  interestedCount,
  bouncedCount,
  replyRate,
  periodTrend,
} from "@/lib/analytics";
import { useDelayed } from "@/hooks/use-delayed";
import { PageHeader } from "@/components/layout/page-header";
import { SELECT_CLS } from "@/lib/design";
import { Section } from "@/components/dashboard/section";
import { MetricRail, type Metric } from "@/components/dashboard/metric-rail";
import { Reveal } from "@/components/dashboard/reveal";
import { ScrollProgress } from "@/components/dashboard/scroll-progress";
import { FindingLine } from "@/components/analytics/finding";
import { ConversionSpine } from "@/components/analytics/conversion-spine";
import { TrendPanel } from "@/components/analytics/trend-panel";
import { ReplyTimingPanel } from "@/components/analytics/reply-timing";
import { DriverBoard } from "@/components/analytics/driver-board";
import { SourceQualityMatrix } from "@/components/analytics/source-quality-matrix";
import { EngagementLedger, type EngagementHealth } from "@/components/analytics/engagement-ledger";
import { Leaderboard } from "@/components/analytics/leaderboard";
import { PanelError } from "@/components/analytics/states";


/** Quiet cross-link used as a Section action. */
function XLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-1 text-xs text-primary-ink hover:underline">
      {children}
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";
  const [weeks, setWeeks] = useState(12);

  const overviewQ = useAnalyticsOverview();
  const tsQ = useTimeseries(weeks);
  const categoriesQ = useResponseByCategory();
  const layersQ = useResponseByLayer();
  const sourcesQ = useSources();
  const engagementsQ = useByEngagement();
  const timingQ = useReplyTiming();
  const analystsQ = useByAnalyst({ enabled: isPartner });
  const projectsQ = useProjectAnalytics({ enabled: isPartner });

  // Skeleton discipline: a cached load resolves in ~40ms — only show placeholders
  // once the wait has actually passed 300ms.
  const slowOverview = useDelayed(overviewQ.isLoading && !overviewQ.data);
  const slowDrivers = useDelayed(categoriesQ.isLoading || layersQ.isLoading || sourcesQ.isLoading);
  const slowEngagements = useDelayed(engagementsQ.isLoading);
  const slowAnalysts = useDelayed(analystsQ.isLoading);

  const overview = overviewQ.data;
  const series = useMemo(() => tsQ.data?.items ?? [], [tsQ.data]);

  // ── Derived headline numbers (all-time, from by_status) ──────────────────────
  const byStatus = overview?.by_status ?? {};
  const total = overview?.total ?? 0;
  const contacted = contactedCount(byStatus, total);
  const replied = repliedCount(byStatus);
  const interested = interestedCount(byStatus);
  const bounced = bouncedCount(byStatus);
  const rate = replyRate(contacted, replied);
  const bounceRate = replyRate(contacted, bounced);
  const respondedPct = overview?.responded_pct ?? 0;

  // ── Period momentum (window-scoped) ──────────────────────────────────────────
  const trend = periodTrend(series);
  const sentDelta = trend.comparable ? trend.sentRecent - trend.sentOlder : null;
  const rateDelta = trend.comparable ? trend.deltaPts : null;

  const findings = useMemo(
    () =>
      buildFindings({
        overview,
        series,
        weeks,
        categories: categoriesQ.data?.items ?? [],
        layers: layersQ.data?.items ?? [],
      }),
    [overview, series, weeks, categoriesQ.data, layersQ.data],
  );

  // ── Partner enrichment: mandate_id → project health ──────────────────────────
  const health = useMemo(() => {
    const m = new Map<number, EngagementHealth>();
    for (const p of projectsQ.data?.items ?? []) {
      for (const e of p.engagements) {
        m.set(e.id, { projectId: p.id, overdue: e.overdue_count, needsFirst: e.needs_initial_count });
      }
    }
    return m;
  }, [projectsQ.data]);

  const metrics: Metric[] = [
    {
      label: "Emails sent",
      value: overviewQ.isLoading ? null : overview?.emails_sent ?? 0,
      icon: Send,
      spark: series.map((s) => s.sent),
      delta: sentDelta,
    },
    {
      label: "Reply rate",
      value: overviewQ.isLoading ? null : Math.round(rate * 100),
      icon: CheckCircle2,
      isPercent: true,
      hint: overview ? `${replied} of ${contacted} contacted` : undefined,
      delta: rateDelta,
    },
    {
      label: "Interested",
      value: overviewQ.isLoading ? null : interested,
      icon: Sparkles,
      hint: "warm leads",
    },
    {
      label: "Bounce rate",
      value: overviewQ.isLoading ? null : Math.round(bounceRate * 100),
      icon: MailX,
      isPercent: true,
      hint: overview ? `${bounced} bounced` : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ScrollProgress className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6" />
      <PageHeader
        title="Analytics"
        description="Is outreach working — replies, where they leak, and what's driving them."
        actions={
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className={SELECT_CLS}
            aria-label="Trend window"
          >
            <option value={8}>Last 8 weeks</option>
            <option value={12}>Last 12 weeks</option>
            <option value={26}>Last 26 weeks</option>
            <option value={52}>Last 52 weeks</option>
          </select>
        }
      />

      {/* THE FINDING — computed thesis, leads the page */}
      {overviewQ.isError ? (
        <div className="rounded-lg bg-card p-2 ring-1 ring-border">
          <PanelError label="analytics" onRetry={() => overviewQ.refetch()} />
        </div>
      ) : (
        <FindingLine findings={findings} loading={slowOverview} />
      )}

      {/* Headline KPIs */}
      <MetricRail metrics={metrics} columns={4} isLoading={slowOverview} />

      {/* SIGNATURE — the Conversion Spine (outreach funnel) */}
      <Reveal>
        <Section
          title="Outreach funnel · to date"
          icon={<GitBranchPlus className="h-3.5 w-3.5 text-primary-ink" />}
          action={<XLink href="/sourcing/analytics">Sourcing funnel</XLink>}
          className="hover-lift"
        >
          {overviewQ.isError ? (
            <PanelError label="the funnel" onRetry={() => overviewQ.refetch()} />
          ) : overview ? (
            <ConversionSpine byStatus={byStatus} total={total} />
          ) : (
            <div className="h-40 animate-pulse rounded-md bg-ink-100" />
          )}
        </Section>
      </Reveal>

      {/* Trend + reply timing */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Section
            title="Volume & replies"
            icon={<TrendingUp className="h-3.5 w-3.5 text-primary-ink" />}
            className="hover-lift"
          >
            {tsQ.isError ? (
              <PanelError label="the trend" onRetry={() => tsQ.refetch()} />
            ) : (
              <TrendPanel series={series} weeks={weeks} />
            )}
          </Section>
        </Reveal>
        <Reveal className="lg:col-span-5" delay={90}>
          <Section
            title="Reply timing · to date"
            icon={<Timer className="h-3.5 w-3.5 text-primary-ink" />}
            className="hover-lift"
          >
            {timingQ.isError ? (
              <PanelError label="reply timing" onRetry={() => timingQ.refetch()} />
            ) : timingQ.data ? (
              <ReplyTimingPanel data={timingQ.data} />
            ) : (
              <div className="h-40 animate-pulse rounded-md bg-ink-100" />
            )}
          </Section>
        </Reveal>
      </div>

      {/* Driver board */}
      <Reveal>
        <Section
          title="What's driving responses · to date"
          icon={<Layers className="h-3.5 w-3.5 text-primary-ink" />}
          className="hover-lift"
        >
          {categoriesQ.isError || layersQ.isError || sourcesQ.isError ? (
            <PanelError
              label="segments"
              onRetry={() => {
                categoriesQ.refetch();
                layersQ.refetch();
                sourcesQ.refetch();
              }}
            />
          ) : (
            <DriverBoard
              categories={categoriesQ.data?.items ?? []}
              layers={layersQ.data?.items ?? []}
              sources={sourcesQ.data?.items ?? []}
              benchmark={respondedPct}
              loading={slowDrivers}
            />
          )}
        </Section>
      </Reveal>

      {/* Source × quality heatmap */}
      <Reveal>
        <Section
          title="Source × quality · to date"
          icon={<Grid3x3 className="h-3.5 w-3.5 text-primary-ink" />}
          className="hover-lift"
        >
          {sourcesQ.isError ? (
            <PanelError label="source quality" onRetry={() => sourcesQ.refetch()} />
          ) : sourcesQ.data ? (
            <SourceQualityMatrix rows={sourcesQ.data.items} />
          ) : (
            <div className="h-40 animate-pulse rounded-md bg-ink-100" />
          )}
        </Section>
      </Reveal>

      {/* Engagement ledger */}
      <Reveal>
        <Section
          title="By engagement · to date"
          className="hover-lift"
          action={isPartner ? <XLink href="/analytics/projects">Project health</XLink> : undefined}
        >
          {engagementsQ.isError ? (
            <PanelError label="engagements" onRetry={() => engagementsQ.refetch()} />
          ) : (
            <EngagementLedger
              rows={engagementsQ.data?.items ?? []}
              health={isPartner ? health : undefined}
              loading={slowEngagements}
            />
          )}
        </Section>
      </Reveal>

      {/* Role split — partner leaderboard (cross-links) / analyst cross-link */}
      {isPartner ? (
        <Reveal>
          <Section title="Analyst leaderboard" icon={<Users className="h-3.5 w-3.5 text-primary-ink" />} className="hover-lift">
            {analystsQ.isError ? (
              <PanelError label="analysts" onRetry={() => analystsQ.refetch()} />
            ) : (
              <Leaderboard rows={analystsQ.data?.items ?? []} loading={slowAnalysts} />
            )}
          </Section>
        </Reveal>
      ) : (
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 px-4 py-3 text-sm ring-1 ring-border">
            <span className="text-muted-foreground">
              These figures cover <span className="font-medium text-foreground">your book</span> — the mandates assigned to you.
            </span>
            <XLink href="/sourcing/analytics">See sourcing funnel</XLink>
          </div>
        </Reveal>
      )}
    </div>
  );
}
