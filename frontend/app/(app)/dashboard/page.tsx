"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  Filter,
  Layers,
  Plus,
  Tag,
  TrendingUp,
} from "lucide-react";

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
import { ActivityFeed } from "@/components/features/activity-feed";
import { TaskDialog } from "@/components/features/task-dialog";
import { TaskList } from "@/components/features/task-list";
import { Avatar } from "@/components/ui/avatar";
import { useRecentActivity } from "@/hooks/use-activity";
import { useTasks, useTaskSummary } from "@/hooks/use-tasks";
import { DeskBriefing } from "@/components/dashboard/desk-briefing";
import { BookTape, type TapeStat } from "@/components/dashboard/book-tape";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { useDelayed } from "@/hooks/use-delayed";
import { Section } from "@/components/dashboard/section";
import { TrendPanel } from "@/components/analytics/trend-panel";
import { PanelError } from "@/components/analytics/states";
import { PageHeader } from "@/components/layout/page-header";
import {
  CHIP,
  CHIP_TONE,
  DEAL_TYPE_STYLE,
  DEAL_TYPE_SHORT,
  DUE_TOKEN,
  LATE_TOKEN,
  MONO,
} from "@/lib/design";
import { dealLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MandateType, Task } from "@/types";

interface FocusDeal {
  type: MandateType;
  name: string;
}

/** Shared track for the focus table's header and rows, so every column aligns. */
const FOCUS_COLS =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 md:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_minmax(0,9rem)_5.5rem_auto]";

function istDate() {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Asia/Kolkata",
    }).format(new Date());
  } catch {
    return "";
  }
}

/** One row of Today's focus: who, which deal, who to write to, how late, and log it. */
function FocusRow({ row, deal }: { row: ScheduleRow; deal?: FocusDeal }) {
  const overdue = row.is_overdue;
  const age = Math.abs(row.days_remaining ?? 0);
  const contact = row.primary_contact?.name;

  return (
    <li className={cn(FOCUS_COLS, "group px-4 py-2 transition-colors hover:bg-subtle")}>
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/companies/${row.company_id}`}
          className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.company_name}
        </Link>
        {row.schedule_status === "AWAITING_INITIAL" && (
          <span className={cn(CHIP, CHIP_TONE.outline, "hidden border-dashed sm:inline-flex")}>
            First email
          </span>
        )}
      </div>

      <div className="hidden min-w-0 items-center gap-1.5 md:flex">
        {deal && (
          <span className={cn("shrink-0 rounded-[3px] px-1 text-[10px] leading-4", DEAL_TYPE_STYLE[deal.type])}>
            {DEAL_TYPE_SHORT[deal.type]}
          </span>
        )}
        {deal?.name && (
          <span className="truncate text-xs text-muted-foreground" title={deal.name}>
            {deal.name}
          </span>
        )}
      </div>

      <span
        className="hidden truncate text-xs text-muted-foreground md:block"
        title={contact ?? undefined}
      >
        {contact ?? "No contact"}
      </span>

      <span className="text-right" style={MONO}>
        {overdue ? (
          <span className={LATE_TOKEN}>{age}d late</span>
        ) : (
          <span className={DUE_TOKEN}>Today</span>
        )}
      </span>

      <LogOutreachDialog
        companyId={row.company_id}
        companyName={row.company_name}
        defaultEventType={row.schedule_status === "AWAITING_INITIAL" ? "INITIAL_EMAIL" : "FOLLOW_UP"}
        trigger={
          <Button size="sm" variant="outline" className="shrink-0">
            Log
          </Button>
        }
      />
    </li>
  );
}

/** Response rate by category — low-n aware: denominators shown, thin buckets recessed
 *  and excluded from the ranking. Rows drill to the Master List. */
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
          <div key={i} className="h-5 animate-pulse rounded bg-ink-100" />
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
        <span
          className={cn("w-28 shrink-0 truncate text-xs", isThin ? "text-muted-foreground" : "text-foreground")}
          title={r.label}
        >
          {r.label}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", above ? "bg-foreground" : "bg-ink-300")}
            style={{ width: `${Math.max(r.rate > 0 ? 4 : 0, (r.rate / maxRate) * 100)}%` }}
          />
        </div>
        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground" style={MONO}>
          <span className={cn(!isThin && "font-medium text-foreground")}>{pctLabel(r.rate)}</span>{" "}
          {r.responded}/{r.total}
        </span>
      </>
    );
    return r.href && !isThin ? (
      <Link href={r.href} className="-mx-1.5 flex items-center gap-3 rounded-md px-1.5 py-0.5 transition-colors hover:bg-subtle">
        {inner}
      </Link>
    ) : (
      <div className="flex items-center gap-3 py-0.5">{inner}</div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Ranked by response rate</span>
        <span style={MONO}>Firm average {pctLabel(benchmark)}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {ranked.slice(0, 6).map((r) => (
          <li key={r.label}>
            <Bar r={r} />
          </li>
        ))}
        {thin.length > 0 && (
          <>
            <li className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              Thin data, fewer than 5
              <span className="h-px flex-1 bg-border" />
            </li>
            {thin.slice(0, 3).map((r) => (
              <li key={r.label}>
                <Bar r={r} thin />
              </li>
            ))}
          </>
        )}
      </ul>
      <div className="mt-1 flex items-center gap-4 border-t border-border pt-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-foreground" /> At or above average
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-ink-300" /> Below
        </span>
      </div>
    </div>
  );
}

const PANEL_LINK =
  "group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground";

export default function DashboardPage() {
  const overviewQ = useAnalyticsOverview();
  const categoriesQ = useResponseByCategory();
  const dueQ = useDue(7);
  const tsQ = useTimeseries(12);
  const { data: mandates } = useMandates();
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";

  // A partner's desk shows the firm's work by analyst; an analyst's shows their own.
  const myTasksQ = useTasks(
    isPartner ? { page_size: 200 } : { assignee_id: user?.id, page_size: 200 },
    !!user,
  );
  const taskSummaryQ = useTaskSummary();
  const activityQ = useRecentActivity(isPartner ? 10 : 6);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
      label: "Emails this week",
      value: tsQ.data ? sentWeek : null,
      delta: sentDelta,
      spark: series.map((s) => s.sent),
    },
    {
      label: "Replies this week",
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
      label: "Needs first email",
      value: overview?.needs_initial ?? null,
      hint: overview?.needs_initial ? "awaiting an intro" : undefined,
    },
  ];

  const workTitle = isPartner ? "Team workload" : "My work";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Home"
        description={[istDate(), user?.firm?.name].filter(Boolean).join(" · ")}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setEditingTask(null);
              setTaskDialogOpen(true);
            }}
          >
            <Plus aria-hidden />
            New task
          </Button>
        }
      />

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

      {/* A partner opens the desk to read its state; an analyst opens it to work. Same
          figures, same components — the order is the whole difference. */}
      {isPartner && <BookTape stats={stats} isLoading={slowOverview} />}

      {/* The pairing is the point: "Today's focus" is work the cadence engine DERIVED;
          the right column is work a person DECLARED. An analyst's day is the union. */}
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Section
          className="lg:col-span-8"
          title="Today's focus"
          icon={<Clock />}
          badge={
            focusRows.length > 0 ? (
              <span className="text-xs text-muted-foreground" style={MONO}>
                {overdueRows.length} overdue · {dueTodayRows.length} today
              </span>
            ) : undefined
          }
          action={
            <Link href="/schedule" className={PANEL_LINK}>
              Open the queue
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
          flush
        >
          {dueQ.isError ? (
            <PanelError label="your queue" onRetry={() => dueQ.refetch()} />
          ) : focusRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-14 text-center">
              <CheckCircle2 className="mb-1 h-6 w-6 text-success" strokeWidth={1.75} />
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
                  className="group flex items-center gap-2 border-b border-border bg-subtle px-4 py-2.5 text-xs transition-colors hover:bg-muted"
                >
                  <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    <span className="font-semibold text-foreground" style={MONO}>
                      {topMandateCount}
                    </span>{" "}
                    of your {overdueRows.length} overdue are in{" "}
                    <span className="font-medium text-foreground">{topDeal.name}</span> — batch them in one pass.
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground">
                    Work this deal
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              )}
              <div
                className={cn(FOCUS_COLS, "hidden h-8 border-b border-border bg-muted px-4 text-xs font-medium text-muted-foreground md:grid")}
                aria-hidden
              >
                <span>Company</span>
                <span>Engagement</span>
                <span>Contact</span>
                <span className="text-right">Due</span>
                <span className="w-[42px]" />
              </div>
              <ul className="divide-y divide-border">
                {focusRows.slice(0, 8).map((row) => (
                  <FocusRow key={row.company_id} row={row} deal={dealById.get(row.mandate_id)} />
                ))}
              </ul>
              {focusRows.length > 8 && (
                <Link
                  href="/schedule"
                  className="group flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground"
                >
                  <span style={MONO}>{focusRows.length - 8}</span>
                  more in the queue
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </>
          )}
        </Section>

        <Section
          className="lg:col-span-4"
          title={workTitle}
          icon={<CheckSquare />}
          badge={
            taskSummaryQ.data ? (
              <span className="text-xs text-muted-foreground" style={MONO}>
                {taskSummaryQ.data.open} open
                {taskSummaryQ.data.overdue > 0 && (
                  <span className="text-danger-ink"> · {taskSummaryQ.data.overdue} overdue</span>
                )}
              </span>
            ) : undefined
          }
          action={
            <Link href="/tasks" className={PANEL_LINK}>
              {isPartner ? "All work" : "Open"}
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
          flush
        >
          {isPartner ? (
            <TeamWorkload tasks={myTasksQ.data?.items ?? []} isLoading={myTasksQ.isLoading} />
          ) : (
            <div className="px-3 py-1">
              <TaskList
                tasks={myTasksQ.data?.items ?? []}
                isLoading={myTasksQ.isLoading}
                onEdit={(t) => {
                  setEditingTask(t);
                  setTaskDialogOpen(true);
                }}
                defaults={{ title: "" }}
                addPlaceholder="Add a task and press Enter"
                emptyMessage="Nothing assigned to you. Add the first one above."
              />
            </div>
          )}
        </Section>
      </div>

      {/* An analyst gets the numbers after the work, not before it. */}
      {!isPartner && <BookTape stats={stats} isLoading={slowOverview} />}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Section
          className="lg:col-span-7"
          title="Volume and replies, last 12 weeks"
          icon={<TrendingUp />}
          action={
            <Link href="/analytics" className={PANEL_LINK}>
              Analytics
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
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
          className="lg:col-span-5"
          title="Sourcing pipeline"
          icon={<Filter />}
          action={
            <Link href="/master" className={PANEL_LINK}>
              Master List
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        >
          {overviewQ.isError ? (
            <PanelError label="the pipeline" onRetry={() => overviewQ.refetch()} />
          ) : overview ? (
            <PipelineFunnel byStatus={byStatus} total={overview.total} />
          ) : (
            <div className="h-56 animate-pulse rounded-md bg-ink-100" />
          )}
        </Section>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Section
          className="lg:col-span-7"
          title={isPartner ? "Desk activity" : "Recent activity"}
          icon={<Activity />}
          action={
            <Link href="/tasks" className={PANEL_LINK}>
              {isPartner ? "Everything" : "Your trail"}
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        >
          <ActivityFeed
            events={activityQ.data?.items ?? []}
            isLoading={activityQ.isLoading}
            isError={activityQ.isError}
            onRetry={() => activityQ.refetch()}
            compact
            showFilters={false}
            emptyLine={
              isPartner
                ? "Nothing has happened on the desk yet."
                : "Nothing logged yet — your work will show up here."
            }
          />
        </Section>

        <Section className="lg:col-span-5" title="Response rate by category" icon={<Tag />}>
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

      <TaskDialog
        task={editingTask}
        open={taskDialogOpen}
        onOpenChange={(o) => {
          setTaskDialogOpen(o);
          if (!o) setEditingTask(null);
        }}
      />
    </div>
  );
}

/**
 * Open and overdue work by analyst — the partner's half of "My work".
 *
 * Grouped in the browser rather than asked for as its own endpoint: the task list is
 * already loaded for this page. Each row links into the filtered list, so "who is
 * carrying what" is one click from "what exactly".
 */
function TeamWorkload({ tasks, isLoading }: { tasks: Task[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-ink-100" />
        ))}
      </div>
    );
  }

  const byAssignee = new Map<string, { id: number | null; open: number; overdue: number }>();
  for (const t of tasks) {
    if (t.status === "DONE") continue;
    const name = t.assignee_name ?? "Unassigned";
    const row = byAssignee.get(name) ?? { id: t.assignee_id, open: 0, overdue: 0 };
    row.open += 1;
    if (t.is_overdue) row.overdue += 1;
    byAssignee.set(name, row);
  }

  const rows = [...byAssignee.entries()].sort(
    (a, b) => b[1].overdue - a[1].overdue || b[1].open - a[1].open,
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-xs text-muted-foreground">
        Nobody has open work on the board.
      </p>
    );
  }

  const maxOpen = Math.max(1, ...rows.map(([, r]) => r.open));

  return (
    <ul className="divide-y divide-border">
      {rows.map(([name, row]) => (
        <li key={name}>
          <Link
            href={row.id ? `/tasks?assignee=${row.id}` : "/tasks"}
            className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-subtle"
          >
            <Avatar name={name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{name}</span>
              <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-ink-100">
                <span
                  className="block h-full rounded-full bg-ink-400"
                  style={{ width: `${(row.open / maxOpen) * 100}%` }}
                />
              </span>
            </span>
            {row.overdue > 0 && (
              <span className={cn(CHIP, CHIP_TONE.danger)} style={MONO}>
                {row.overdue} late
              </span>
            )}
            <span className="w-14 shrink-0 text-right text-xs text-muted-foreground" style={MONO}>
              {row.open} open
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
