"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Snowflake,
  Users,
} from "lucide-react";

import { useByAnalyst, useProjectAnalytics } from "@/hooks/use-analytics";
import { useDelayed } from "@/hooks/use-delayed";
import { PageHeader } from "@/components/layout/page-header";
import { MetricRail, type Metric } from "@/components/dashboard/metric-rail";
import { BookComposition, type CompositionRow } from "@/components/analytics/book-composition";
import { PanelEmpty, PanelError } from "@/components/analytics/states";
import { DEAL_TYPE_SHORT, DEAL_TYPE_STYLE, MONO } from "@/lib/design";
import { Skeleton } from "@/components/ui/skeleton";
import { bookComposition, isThin, MIN_N, pctLabel, replyRate } from "@/lib/analytics";
import { DISPLAY, LABEL } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { EngagementAnalytics, ProjectAnalyticsItem } from "@/types";


/**
 * Project health — the partner's firm-wide read.
 *
 * Every rate here is `replied ÷ contacted` (lib/analytics `replyRate`), never
 * `responded ÷ everything` — a book full of companies nobody has emailed yet
 * must not read as a bad reply rate. Rates over a thin sample (n < MIN_N) are
 * shown with their denominator but visually recessed and never ranked.
 */

// ── Small parts ───────────────────────────────────────────────────────────────

function Panel({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl bg-card p-4 ring-1 ring-border", className)}>
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

/** A rate with its denominator, recessed when the sample is too thin to trust. */
function Rate({ contacted, replied }: { contacted: number; replied: number }) {
  const thin = isThin(contacted);
  return (
    <span
      /* Thin samples are recessed by *colour*, not alpha: opacity-55 dropped the
         denominator to 2.33:1 and made the least trustworthy number the hardest
         to read. */
      className={cn("flex items-baseline gap-1.5 text-sm", thin && "[&_*]:text-muted-foreground")}
      title={thin ? `Thin sample — fewer than ${MIN_N} companies contacted` : undefined}
    >
      <span className="font-medium tabular-nums text-foreground" style={MONO}>
        {contacted > 0 ? pctLabel(replyRate(contacted, replied)) : "—"}
      </span>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {replied}/{contacted} replied
      </span>
    </span>
  );
}

function Pill({
  icon: Icon,
  value,
  label,
  tone,
  href,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  tone?: "warn" | "cold";
  href?: string;
}) {
  if (!value) return null;
  const body = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]",
        tone === "warn" && "bg-destructive/10 text-destructive-ink",
        tone === "cold" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        !tone && "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="font-medium tabular-nums" style={MONO}>
        {value}
      </span>
      {label}
    </span>
  );
  return href ? (
    <Link href={href} className="transition-opacity hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

// ── Engagement row ────────────────────────────────────────────────────────────

function EngagementRow({ eng, projectId }: { eng: EngagementAnalytics; projectId: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 border-t border-border px-4 py-2.5 transition-colors hover:bg-muted/20">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
            DEAL_TYPE_STYLE[eng.type],
          )}
        >
          {DEAL_TYPE_SHORT[eng.type]}
        </span>
        <span className="truncate text-sm font-medium">{eng.name}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Building2 className="size-3" aria-hidden />
          <span className="tabular-nums text-foreground" style={MONO}>
            {eng.total_companies}
          </span>
        </span>
        <Rate contacted={eng.contacted} replied={eng.replied} />
        <Pill
          icon={AlertTriangle}
          value={eng.overdue_count}
          label="overdue"
          tone="warn"
          href={`/schedule?deal=${eng.id}`}
        />
        <Pill icon={Snowflake} value={eng.cold_count} label="cold" tone="cold" />
        <Pill icon={Clock} value={eng.needs_initial_count} label="need first touch" />
        <Link
          href={`/projects/${projectId}?book=${eng.id}`}
          className="shrink-0 text-xs font-medium text-primary-ink hover:underline"
        >
          Book →
        </Link>
      </div>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ item }: { item: ProjectAnalyticsItem }) {
  const [expanded, setExpanded] = useState(true);
  const h = item.headline;

  return (
    <div className="hover-lift overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full px-4 pt-3.5 pb-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="truncate text-base font-semibold tracking-tight"
                style={{ ...DISPLAY, letterSpacing: "-0.3px" }}
              >
                {item.name}
              </span>
              {item.engagements.length > 0 && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {item.engagements.length} mandate{item.engagements.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.client_name}</p>
          </div>
          {expanded ? (
            <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Building2 className="size-3" aria-hidden />
            <span className="tabular-nums text-foreground" style={MONO}>
              {h.total_companies}
            </span>{" "}
            companies
          </span>
          <Rate contacted={h.contacted} replied={h.replied} />
          <Pill icon={AlertTriangle} value={h.overdue_count} label="overdue" tone="warn" />
          <Pill icon={Snowflake} value={h.cold_count} label="cold" tone="cold" />
          <Pill icon={Clock} value={h.needs_initial_count} label="need first touch" />
        </div>
      </button>

      {expanded &&
        (item.engagements.length > 0 ? (
          <div className="pb-1.5">
            {item.engagements.map((eng) => (
              <EngagementRow key={eng.id} eng={eng} projectId={item.id} />
            ))}
          </div>
        ) : (
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            No mandates in this project yet —{" "}
            {/* Underlined at rest: amber against muted body copy is only a 2.1:1
                difference, so colour alone never marked this as a link. */}
            <Link
              href={`/projects/${item.id}`}
              className="text-primary-ink underline underline-offset-2 hover:no-underline"
            >
              open the project
            </Link>{" "}
            to add one.
          </p>
        ))}
    </div>
  );
}

// ── Analyst activity ──────────────────────────────────────────────────────────

function AnalystTable() {
  const { data, isLoading, isError, refetch } = useByAnalyst();
  const showSkeleton = useDelayed(isLoading);

  return (
    <Panel title="Analyst activity" hint="Touches logged and replies captured, per analyst">
      {isError ? (
        <PanelError label="analyst activity" onRetry={() => refetch()} />
      ) : isLoading ? (
        showSkeleton ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : null
      ) : (data?.items ?? []).length === 0 ? (
        <PanelEmpty
          line="No outreach logged by anyone yet."
          cta="Open the outreach desk"
          href="/schedule"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Analyst", "Touches", "Initial emails", "Replies", "Reply rate"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                      i === 0 ? "px-1 text-left" : "px-3 text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((r) => (
                <tr key={r.user_id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-1 py-2 font-medium">{r.full_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={MONO}>
                    {r.total_events}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={MONO}>
                    {r.initial_emails}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={MONO}>
                    {r.responses}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      // Recess thin samples by colour, not alpha (see Rate above).
                      isThin(r.initial_emails) && "[&_*]:text-muted-foreground",
                    )}
                    style={MONO}
                    title={
                      isThin(r.initial_emails)
                        ? `Thin sample — fewer than ${MIN_N} initial emails`
                        : undefined
                    }
                  >
                    {pctLabel(r.conversion_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsProjectsPage() {
  const { data, isLoading, isError, error, refetch } = useProjectAnalytics();
  const showSkeleton = useDelayed(isLoading);
  const items = useMemo(() => data?.items ?? [], [data]);

  const totals = useMemo(() => {
    let engagements = 0,
      companies = 0,
      contacted = 0,
      replied = 0,
      overdue = 0,
      needsFirst = 0;
    for (const p of items) {
      engagements += p.engagements.length;
      companies += p.headline.total_companies;
      contacted += p.headline.contacted;
      replied += p.headline.replied;
      overdue += p.headline.overdue_count;
      needsFirst += p.headline.needs_initial_count;
    }
    return { engagements, companies, contacted, replied, overdue, needsFirst };
  }, [items]);

  const composition: CompositionRow[] = useMemo(
    () =>
      items
        .filter((p) => p.headline.total_companies > 0)
        .map((p) => ({
          name: p.name,
          ...bookComposition({
            total: p.headline.total_companies,
            contacted: p.headline.contacted,
            replied: p.headline.replied,
          }),
        })),
    [items],
  );

  const metrics: Metric[] = [
    { label: "Projects", value: items.length, icon: Building2 },
    { label: "Engagements", value: totals.engagements, icon: Users },
    { label: "Companies", value: totals.companies, icon: Building2 },
    {
      label: "Reply rate",
      value: Math.round(replyRate(totals.contacted, totals.replied) * 100),
      isPercent: true,
      icon: MessageSquare,
      hint: `${totals.replied}/${totals.contacted} contacted`,
    },
    {
      label: "Overdue",
      value: totals.overdue,
      icon: AlertTriangle,
      hint: totals.needsFirst ? `${totals.needsFirst} never emailed` : undefined,
    },
  ];

  const forbidden = isError && error instanceof Error && error.message.includes("403");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Project health"
        description="Firm-wide coverage and reply rates, by project and engagement — partner view"
      />

      {forbidden ? (
        <Panel title="Project health">
          <PanelEmpty line="Partner role required to see the firm-wide view." cta="Back to analytics" href="/analytics" />
        </Panel>
      ) : isError ? (
        <Panel title="Project health">
          <PanelError label="project health" onRetry={() => refetch()} />
        </Panel>
      ) : (
        <>
          <MetricRail metrics={metrics} isLoading={isLoading && showSkeleton} />

          <Panel
            title="Book composition"
            hint="How much of each book has actually been worked"
          >
            {isLoading ? (
              showSkeleton ? (
                <Skeleton className="h-56 rounded-lg" />
              ) : null
            ) : (
              <BookComposition rows={composition} />
            )}
          </Panel>

          {isLoading ? (
            showSkeleton ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((n) => (
                  <Skeleton key={n} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : null
          ) : items.length === 0 ? (
            <Panel title="Projects">
              <PanelEmpty
                line="No projects yet — a project is the client folder every engagement hangs off."
                cta="Create the first project"
                href="/projects"
              />
            </Panel>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <ProjectCard key={item.id} item={item} />
              ))}
            </div>
          )}

          <AnalystTable />
        </>
      )}
    </div>
  );
}
