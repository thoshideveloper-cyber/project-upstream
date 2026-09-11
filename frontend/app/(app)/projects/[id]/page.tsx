"use client";

/**
 * Project overview — the answer to "what is happening here", before the table.
 *
 * The workspace is the right screen for doing the work and the wrong one for arriving.
 * This page answers five questions in the order a person actually asks them:
 *
 *   1. What needs my attention?      → the queue, as rows you can act on
 *   2. How is this project doing?    → the progression, step by step
 *   3. Where is the work?            → the engagement roll-up
 *   4. What is in flight?            → open work, due first
 *   5. What changed?                 → the last few events
 *
 * Every panel is a real read of real fields and every panel dead-ends somewhere useful.
 * If a section has nothing to say it says so in one line and points at the thing that
 * would give it something to say.
 */

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckSquare, ChevronRight, Inbox, Plus, UserX } from "lucide-react";

import { ActivityFeed } from "@/components/features/activity-feed";
import { TaskList } from "@/components/features/task-list";
import { HealthBar } from "@/components/project/health-bar";
import { useProjectShell } from "@/components/project/project-context";
import { PanelEmpty } from "@/components/analytics/states";
import { Button } from "@/components/ui/button";
import { useProjectActivity } from "@/hooks/use-activity";
import { useCompanies } from "@/hooks/use-companies";
import { useTasks } from "@/hooks/use-tasks";
import {
  AWAITING_DOT,
  AWAITING_INK,
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  INK_LINK,
  LABEL,
  LATE_TOKEN,
  MONO,
  PANEL,
  PANEL_TITLE,
} from "@/lib/design";
import { fmtDate } from "@/lib/format";
import {
  attentionQueue,
  bucketTasksByDue,
  needsAttention,
  progressSteps,
  vitalsOf,
  type AttentionItem,
} from "@/lib/project";
import { todayISO } from "@/lib/tasks";
import { condition, workspaceHref } from "@/lib/project-views";
import { cn } from "@/lib/utils";

/** How many attention rows the overview lists before it defers to the workspace. */
const QUEUE_LIMIT = 7;

/**
 * The progression darkens as it converts: a sourced company is the lightest ink, an
 * interested one the darkest. Ink concentrating toward the bottom is the funnel, drawn.
 */
const STEP_FILL = ["bg-ink-300", "bg-ink-500", "bg-success", "bg-success"];

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);
  const { project, engagements, openNewTask, openAddEngagement } = useProjectShell();

  useLegacyViewRedirect(projectId);

  // One read of the project's book, shared by the queue and the progression — the two
  // panels are two views of the same rows, and fetching twice is how they drift.
  const { data: companiesData, isLoading: companiesLoading } = useCompanies({
    project_id: projectId,
    page_size: 500,
    sort: "company_name",
  });
  const companies = useMemo(() => companiesData?.items ?? [], [companiesData]);

  const { data: tasksData, isLoading: tasksLoading } = useTasks({ project_id: projectId });
  const tasks = useMemo(() => tasksData?.items ?? [], [tasksData]);

  const { data: activityData, isLoading: activityLoading } = useProjectActivity(projectId);

  const queue = useMemo(() => attentionQueue(companies, QUEUE_LIMIT), [companies]);
  const attentionTotal = useMemo(() => companies.filter(needsAttention).length, [companies]);
  const steps = useMemo(() => progressSteps(companies), [companies]);
  const vitals = useMemo(() => vitalsOf(companies), [companies]);
  const dueBuckets = useMemo(() => bucketTasksByDue(tasks, todayISO()), [tasks]);

  const base = `/projects/${projectId}`;
  const maxEngagement = Math.max(1, ...engagements.map((e) => e.total_companies));

  return (
    // `items-start`: each panel is as tall as its own content. A grid cell otherwise
    // stretches to the tallest panel in its row, and a bordered box with a third of its
    // height empty reads as one that failed to finish loading.
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {/* ── Attention: the widest panel, because it is the only to-do list ── */}
      <section className={cn(PANEL, "lg:col-span-2")}>
        <PanelHeader
          title="Needs attention"
          lead={
            attentionTotal > queue.length
              ? `Late follow-ups first, then intros that never went out — ${queue.length} of ${attentionTotal}.`
              : "Late follow-ups first, then intros that never went out."
          }
          href={workspaceHref(projectId, { view: "attention" })}
          action={attentionTotal > queue.length ? `All ${attentionTotal}` : "Open the workspace"}
        />

        {companiesLoading ? (
          <ul className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-9 animate-pulse rounded-md bg-ink-100" />
            ))}
          </ul>
        ) : queue.length === 0 ? (
          <PanelEmpty
            icon={<Inbox className="size-5 text-muted-foreground" />}
            line={
              companies.length === 0
                ? "No companies in this project yet."
                : "Nothing is late and every intro has gone out."
            }
            cta={companies.length === 0 ? "Open the workspace" : undefined}
            href={companies.length === 0 ? `${base}/workspace` : undefined}
          />
        ) : (
          <ul className="divide-y divide-border">
            {queue.map((item) => (
              <AttentionRow key={item.company.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Progression ─────────────────────────────────────────────────── */}
      <section className={cn(PANEL, "p-4")}>
        <h2 className={PANEL_TITLE}>Progression</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each step as a share of the one above it.
        </p>

        {companies.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Nothing sourced yet.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3.5">
            {steps.map((s, i) => (
              <li key={s.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-foreground">{s.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground" style={MONO}>
                      {s.value}
                    </span>
                    <span
                      className="w-9 text-right text-[11px] tabular-nums text-muted-foreground"
                      style={MONO}
                    >
                      {i > 0 ? `${Math.round(s.ofPrevious * 100)}%` : ""}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={cn("horizon-load h-full rounded-full", STEP_FILL[i] ?? "bg-foreground")}
                    style={{
                      width: `${steps[0].value > 0 ? (s.value / steps[0].value) * 100 : 0}%`,
                      "--load-delay": `${i * 60}ms`,
                    } as React.CSSProperties}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}

        {vitals.cold > 0 && (
          <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <Link href={workspaceHref(projectId, { view: "cold" })} className={INK_LINK}>
              <span className="tabular-nums" style={MONO}>
                {vitals.cold}
              </span>{" "}
              went cold
            </Link>{" "}
            — the follow-up cap was reached without a reply.
          </p>
        )}
      </section>

      {/* ── Engagements ─────────────────────────────────────────────────── */}
      <section className={cn(PANEL, "lg:col-span-2")}>
        <PanelHeader title="Engagements" href={`${base}/workspace`} action="Workspace" />

        {engagements.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              No engagements yet — a project holds one book per engagement.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openAddEngagement}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add the first one
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {engagements.map((e, i) => {
              const replyPct = Math.round((e.response_rate ?? 0) * 100);
              return (
                <li key={e.id}>
                  <Link
                    href={workspaceHref(projectId, { filter: condition("engagement", "any_of", [e.id]) })}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="flex min-w-0 grow basis-56 items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded-[3px] px-1 text-[10px] font-medium leading-4",
                          DEAL_TYPE_STYLE[e.type],
                        )}
                      >
                        {DEAL_TYPE_SHORT[e.type]}
                      </span>
                      <span className="truncate text-sm font-medium">{e.name}</span>
                    </span>

                    <span className="w-full shrink-0 sm:w-40">
                      <HealthBar
                        vitals={{
                          total: e.total_companies,
                          contacted: e.total_companies,
                          replied: e.responded,
                          late: e.overdue_count,
                          awaiting: e.needs_initial_count,
                          cold: e.cold_count,
                          noContact: 0,
                          replyRate: e.response_rate,
                        }}
                        scaleTo={maxEngagement}
                        delay={i * 40}
                      />
                    </span>

                    <span
                      className="flex shrink-0 flex-wrap items-center gap-x-2.5 text-[11px] tabular-nums"
                      style={MONO}
                    >
                      <span className="text-muted-foreground">
                        {e.total_companies} {e.total_companies === 1 ? "company" : "companies"}
                      </span>
                      {e.overdue_count > 0 && (
                        <span className={LATE_TOKEN}>{e.overdue_count} late</span>
                      )}
                      {e.needs_initial_count > 0 && (
                        <span className={cn("inline-flex items-center gap-1", AWAITING_INK)}>
                          <span className={AWAITING_DOT} aria-hidden />
                          {e.needs_initial_count} intro pending
                        </span>
                      )}
                      <span className="text-muted-foreground">{replyPct}% responded</span>
                    </span>

                    <ArrowRight
                      className="ml-auto hidden h-4 w-4 shrink-0 text-ink-300 transition-colors group-hover:text-foreground sm:block"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Work in flight ──────────────────────────────────────────────── */}
      <section className={PANEL}>
        <PanelHeader title="Work in flight" href={`${base}/work`} action="All work" />

        <div className="px-4 py-1">
          {tasksLoading ? (
            <div className="space-y-2 py-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-ink-100" />
              ))}
            </div>
          ) : dueBuckets.length === 0 ? (
            <div className="py-8 text-center">
              <CheckSquare className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden />
              <p className="text-xs text-muted-foreground">Nothing declared on this project.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => openNewTask()}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add a task
              </Button>
            </div>
          ) : (
            // The first two buckets only — this is a summary, and the Work view is one
            // click away for the rest.
            dueBuckets.slice(0, 2).map((bucket) => (
              <div key={bucket.key} className="border-b border-border py-2 last:border-0">
                <p className={cn(LABEL, "mb-1 flex items-center gap-1.5", bucket.key === "overdue" && "text-danger-ink")}>
                  {bucket.key === "overdue" && (
                    <span className="size-1.5 rounded-full bg-danger" aria-hidden />
                  )}
                  {bucket.label} · {bucket.tasks.length}
                </p>
                <TaskList
                  tasks={bucket.tasks.slice(0, 4)}
                  showProject={false}
                  defaults={null}
                  emptyMessage=""
                />
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      <section className={cn(PANEL, "lg:col-span-3")}>
        <PanelHeader
          title="Recent activity"
          lead={
            project.headline.last_activity
              ? `Last outreach ${fmtDate(project.headline.last_activity)}.`
              : "No outreach has been logged on this project yet."
          }
          href={`${base}/activity`}
          action="Full history"
        />
        <div className="p-4">
          <ActivityFeed
            events={(activityData?.items ?? []).slice(0, 8)}
            isLoading={activityLoading}
            compact
            showFilters={false}
            emptyLine="Nothing has been logged on this project yet."
          />
        </div>
      </section>
    </div>
  );
}

/** A panel's title row: what it is, one line on what it answers, and where it leads. */
function PanelHeader({
  title,
  lead,
  href,
  action,
}: {
  title: string;
  lead?: string;
  href: string;
  action: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className={PANEL_TITLE}>{title}</h2>
        {lead && <p className="mt-0.5 text-xs text-muted-foreground">{lead}</p>}
      </div>
      <Link
        href={href}
        className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {action}
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </header>
  );
}

/* ── Legacy `?view=` links ─────────────────────────────────────────────────── */

/**
 * The deal room used to switch views on `?view=book|board|tasks|activity|team`. Those
 * links are in bookmarks, in Slack, and in the product's own older screens, so each one
 * forwards to the route that replaced it rather than silently landing on the overview
 * with a query string nothing reads.
 *
 * `board` maps to the workspace grouped by status — the pipeline board's question
 * ("what state is everything in") asked of the hierarchy that replaced it.
 */
const LEGACY_VIEWS: Record<string, string> = {
  book: "workspace",
  board: "workspace?group=status",
  tasks: "work",
  activity: "activity",
  team: "details",
};

function useLegacyViewRedirect(projectId: number) {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const view = sp.get("view");
    const target = view ? LEGACY_VIEWS[view] : null;
    if (!target) return;
    const book = sp.get("book");
    const sep = target.includes("?") ? "&" : "?";
    router.replace(
      `/projects/${projectId}/${target}${book ? `${sep}book=${book}` : ""}`,
    );
  }, [projectId, router, sp]);
}

/* ── The attention row ─────────────────────────────────────────────────────── */

/**
 * A row that names the problem and offers the fix in the same line.
 *
 * The action is deliberately the *dossier*, not an inline log dialog: the overview's job
 * is to route you, and logging an outreach without opening the company is a workspace
 * action, where the row you just cleared visibly disappears from its group.
 */
function AttentionRow({ item }: { item: AttentionItem }) {
  const { company, kind } = item;

  // The mark says how bad, the line under it says why — never the same word twice.
  const mark =
    kind === "late" ? (
      <span className={LATE_TOKEN} style={MONO}>
        {Math.abs(company.days_remaining ?? 0)}d late
      </span>
    ) : kind === "awaiting" ? (
      <span className={cn("inline-flex items-center gap-1.5 text-xs", AWAITING_INK)}>
        <span className={AWAITING_DOT} aria-hidden />
        Intro pending
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <UserX className="h-3 w-3" aria-hidden />
        No contact
      </span>
    );

  const detail =
    kind === "late"
      ? company.next_due_date
        ? `was due ${fmtDate(company.next_due_date)}`
        : "past its next touch"
      : kind === "awaiting"
        ? "the clock hasn't started"
        : "nobody to email";

  return (
    <li>
      <Link
        href={`/companies/${company.id}`}
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{company.company_name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {[company.category_name, company.hq].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          {mark}
          <span className="text-[11px] text-muted-foreground" style={MONO}>
            {detail}
          </span>
        </span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-ink-300 transition-colors group-hover:text-foreground"
          aria-hidden
        />
      </Link>
    </li>
  );
}
