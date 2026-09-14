"use client";

/**
 * Project analytics — a briefing, read top to bottom.
 *
 * The page this replaces was a grid of six bordered panels. Every panel was individually
 * defensible and the page as a whole answered nothing, because a grid has no order: the
 * reader had to decide which box to read first and then hold the others in their head to
 * make them mean anything together. That is an information-architecture failure, not a
 * styling one, so the panels are gone rather than restyled.
 *
 * What replaces them is a sequence, in the order the questions actually arrive:
 *
 *   1. Where does this project stand?      → the reading, one sentence and six figures
 *   2. Where does outreach convert?        → the funnel, with the leak named
 *   3. What is stalling right now?         → intervention, every row a way in
 *   4. Which book is carrying it?          → per engagement, ranked
 *   5. Which counterparties answer?        → by category or band, thin rows recessed
 *   6. How long does a reply take?         → days and touches, with medians
 *   7. Is it getting better or worse?      → the trend
 *
 * Two rules the whole page obeys:
 *
 *   **Every figure is a link.** A number you cannot follow is a number you have to go
 *   and find, and an analyst who has to rebuild a filter to act on a finding will simply
 *   not act on it. Every count, stage, engagement and segment here deep-links into the
 *   workspace view that holds exactly those records, through `workspaceHref` — one
 *   function, so the number and the list behind it cannot drift apart.
 *
 *   **Every rate carries its denominator, and a thin sample says so.** `MIN_N` is the
 *   floor; below it the figure is recessed and captioned rather than dressed up.
 *
 * All of it reads one response (`/projects/{id}/analytics`), computed server-side from
 * the same service functions the firm-wide page uses. Two panels disagreeing about the
 * reply rate would make every other number on the screen unusable.
 */

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Bar, FigureRail, InterventionRow, Section, SegmentedControl } from "@/components/analytics/briefing";
import { PanelEmpty, PanelError } from "@/components/analytics/states";
import { TrendPanel } from "@/components/analytics/trend-panel";
import { useProjectShell } from "@/components/project/project-context";
import { useProjectAnalytics } from "@/hooks/use-project-analytics";
import type { LatencyDimension } from "@/hooks/use-analytics";
import {
  contactedCount,
  interestedCount,
  isThin,
  pctLabel,
  periodTrend,
  repliedCount,
  MIN_N,
} from "@/lib/analytics";
import {
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  INK_LINK,
  LABEL,
  LATE_TOKEN,
  MONO,
  PANEL,
} from "@/lib/design";
import { condition, workspaceHref } from "@/lib/project-views";
import { cn } from "@/lib/utils";

const WEEKS = 12;

type SegmentAxis = "category" | "band";
type SegmentSort = "rate" | "volume" | "worst";

export default function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);
  const { engagements } = useProjectShell();

  const { data, isLoading, isError, refetch } = useProjectAnalytics(projectId, WEEKS);
  const [axis, setAxis] = useState<SegmentAxis>("category");
  const [segSort, setSegSort] = useState<SegmentSort>("rate");

  const overview = data?.overview;
  const series = useMemo(() => data?.timeseries ?? [], [data]);
  const trend = useMemo(() => periodTrend(series), [series]);

  if (isError) {
    return (
      <div className={cn(PANEL, "p-4")}>
        <PanelError label="this project's analytics" onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !overview) return <BriefingSkeleton />;

  const total = overview.total;
  if (total === 0) {
    return (
      <div className={cn(PANEL, "p-4")}>
        <PanelEmpty
          line="Nothing to measure yet — this project has no companies."
          cta="Open the workspace"
          href={workspaceHref(projectId)}
        />
      </div>
    );
  }

  const contacted = contactedCount(overview.by_status, total);
  const replied = repliedCount(overview.by_status);
  const interested = interestedCount(overview.by_status);
  const rate = contacted > 0 ? replied / contacted : 0;
  const thin = contacted < MIN_N;

  // Cold is a cadence outcome, not a status, so it is not in the analytics overview.
  // It comes from the same per-engagement rollup the project header reads — never from
  // a second definition invented on this page.
  const cold = engagements.reduce((n, e) => n + e.cold_count, 0);

  const href = (opts: Parameters<typeof workspaceHref>[1]) => workspaceHref(projectId, opts);

  const segmentRows: SegmentRow[] =
    axis === "category"
      ? (data?.by_category ?? []).map((r) => ({
          key: `cat-${r.category_id ?? "none"}`,
          label: r.category,
          total: r.total,
          responded: r.responded,
          rate: r.response_rate,
          unclassified: r.category_id == null,
          href: href({
            view: "all",
            group: "flat",
            filter: condition("category", "any_of", [r.category_id ?? "none"]),
          }),
        }))
      : (data?.by_layer ?? []).map((r) => ({
          key: `band-${r.sourcing_layer_id ?? "none"}`,
          label: r.layer,
          total: r.total,
          responded: r.responded,
          rate: r.response_rate,
          unclassified: r.sourcing_layer_id == null,
          href: href({
            view: "all",
            group: "flat",
            filter: condition("band", "any_of", [r.sourcing_layer_id ?? "none"]),
          }),
        }));

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. The reading ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3">
        <p className="max-w-prose text-sm leading-relaxed text-foreground">
          {thin ? (
            <>
              Only{" "}
              <span className="tabular-nums" style={MONO}>
                {contacted}
              </span>{" "}
              {contacted === 1 ? "company has" : "companies have"} been contacted — too
              few to read a rate from. {MIN_N} is the floor this page will quote one at.
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums" style={MONO}>
                {pctLabel(rate)}
              </span>{" "}
              of the{" "}
              <span className="tabular-nums" style={MONO}>
                {contacted}
              </span>{" "}
              companies contacted here have answered.
              {trend.comparable && (
                <>
                  {" "}
                  That is{" "}
                  <span
                    // Direction is the arrow's job; weight says whether it is bad news.
                    className={cn(
                      "inline-flex items-baseline gap-0.5",
                      trend.deltaPts < 0
                        ? "font-semibold text-foreground"
                        : trend.deltaPts > 0
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {trend.deltaPts >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 self-center" aria-hidden />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 self-center" aria-hidden />
                    )}
                    {trend.deltaPts > 0 ? "+" : ""}
                    {trend.deltaPts} points
                  </span>{" "}
                  against the first half of the last {WEEKS} weeks.
                </>
              )}
            </>
          )}
        </p>

        <FigureRail
          figures={[
            {
              key: "total",
              label: "In the book",
              value: String(total),
              href: href({}),
            },
            {
              key: "contacted",
              label: "Contacted",
              value: String(contacted),
              sub: total > 0 ? `${Math.round((contacted / total) * 100)}% of the book` : undefined,
              href: href({ view: "all", group: "flat" }),
            },
            {
              key: "replied",
              label: "Replied",
              value: String(replied),
              sub: `of ${contacted} contacted`,
              tone: "positive",
              href: href({ view: "replied" }),
              quiet: replied === 0,
            },
            {
              key: "rate",
              label: "Reply rate",
              value: thin ? "—" : pctLabel(rate),
              sub: thin ? `only ${contacted} contacted` : `${replied}/${contacted}`,
              quiet: thin,
            },
            {
              key: "late",
              label: "Overdue",
              value: String(overview.overdue),
              sub: "follow-ups",
              tone: "danger",
              href: href({ view: "follow-ups" }),
              quiet: overview.overdue === 0,
            },
            {
              key: "intro",
              label: "Intro pending",
              value: String(overview.needs_initial),
              sub: "never emailed",
              tone: "awaiting",
              href: href({ view: "intro-pending" }),
              quiet: overview.needs_initial === 0,
            },
          ]}
        />
      </header>

      {/* ── 2 & 3. Conversion, and what is blocking it ─────────────────── */}
      <div className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Section title="Where outreach converts" lead="Each step measured against the one above it.">
          <Funnel
            steps={[
              {
                label: "Sourced",
                sub: "in the book",
                value: total,
                fill: "bg-ink-200",
                href: href({}),
              },
              {
                label: "Contacted",
                sub: "first email sent",
                value: contacted,
                fill: "bg-ink-400",
                href: href({ view: "all", group: "flat" }),
                lossLabel: "never emailed",
                lossHref: href({ view: "intro-pending" }),
              },
              {
                label: "Replied",
                sub: "any answer",
                value: replied,
                fill: "bg-ink-700",
                href: href({ view: "replied" }),
                lossLabel: "no answer yet",
                lossHref: href({
                  view: "all",
                  group: "flat",
                  filter: condition("status", "any_of", ["CONTACTED"]),
                }),
              },
              {
                label: "Interested",
                sub: "took it forward",
                value: interested,
                fill: "bg-foreground",
                href: href({
                  view: "all",
                  group: "flat",
                  filter: condition("status", "any_of", ["INTERESTED"]),
                }),
                lossLabel: "answered but not advanced",
              },
            ]}
          />
          {overview.bounced > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              <Link
                href={href({
                  view: "all",
                  group: "flat",
                  filter: condition("status", "any_of", ["BOUNCED"]),
                })}
                className={cn(INK_LINK, "tabular-nums")}
                style={MONO}
              >
                {overview.bounced}
              </Link>{" "}
              bounced — those addresses never reached anyone, so they are not really in
              the contacted count above.
            </p>
          )}
        </Section>

        <Section
          title="Where it is stalling"
          lead="Each of these opens the records behind it."
        >
          <ul className="-mx-1 divide-y divide-border">
            <InterventionRow
              value={overview.overdue}
              label="Overdue follow-ups"
              hint="the next-due date has passed and nothing went out"
              tone="danger"
              href={href({ view: "follow-ups" })}
            />
            <InterventionRow
              value={overview.needs_initial}
              label="Introductions never sent"
              hint="in the book, but the clock has not started"
              tone="awaiting"
              href={href({ view: "intro-pending" })}
            />
            <InterventionRow
              value={cold}
              label="Gone cold"
              hint="the follow-up cap was reached with no answer"
              href={href({ view: "cold" })}
            />
            <InterventionRow
              value={overview.due_this_week}
              label="Due this week"
              hint="running cadences landing in the next seven days"
              href={href({ view: "due-soon" })}
            />
          </ul>
        </Section>
      </div>

      {/* ── 4. Per engagement ──────────────────────────────────────────── */}
      <Section
        title="Which book is carrying it"
        lead="Volume, what it returned, and what is waiting inside each engagement."
      >
        <EngagementTable
          rows={data?.by_engagement ?? []}
          health={engagements}
          projectId={projectId}
        />
      </Section>

      {/* ── 5. Segments ────────────────────────────────────────────────── */}
      <Section
        title="Which counterparties answer"
        lead={
          axis === "category"
            ? "The firm's counterparty vocabulary, ranked by reply rate."
            : "The analyst's own segmentation, ranked by reply rate."
        }
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Segment by"
              value={axis}
              onChange={setAxis}
              options={[
                { value: "category", label: "Category" },
                { value: "band", label: "Band" },
              ]}
            />
            <SegmentedControl
              label="Rank by"
              value={segSort}
              onChange={setSegSort}
              options={[
                { value: "rate", label: "Reply rate" },
                { value: "volume", label: "Volume" },
                { value: "worst", label: "Lowest" },
              ]}
            />
          </div>
        }
      >
        <SegmentTable rows={segmentRows} sort={segSort} axisNoun={axis} />
      </Section>

      {/* ── 6. Response behaviour ──────────────────────────────────────── */}
      <Section
        title="How long a reply takes"
        lead="Measured on the replies this project has actually received."
      >
        {data?.reply_timing && data.reply_timing.responded_total > 0 ? (
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            <Distribution
              title="Days to reply"
              dim={data.reply_timing.days}
              unit="d"
              total={data.reply_timing.responded_total}
            />
            <Distribution
              title="Touches before a reply"
              dim={data.reply_timing.touches}
              unit=""
              total={data.reply_timing.responded_total}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No replies to time yet — this fills in once counterparties start answering.
          </p>
        )}
      </Section>

      {/* ── 7. Over time ───────────────────────────────────────────────── */}
      <Section
        title="Is it getting better or worse"
        lead={`Outreach and replies, week by week.`}
        aside={<span className="text-xs text-muted-foreground">last {WEEKS} weeks</span>}
      >
        {series.some((s) => s.sent > 0 || s.responses > 0) ? (
          <TrendPanel series={series} weeks={WEEKS} compact />
        ) : (
          <p className="text-xs text-muted-foreground">
            No outreach logged in this window.
          </p>
        )}
      </Section>
    </div>
  );
}

/* ── Funnel ────────────────────────────────────────────────────────────────── */

interface FunnelStep {
  label: string;
  sub: string;
  value: number;
  fill: string;
  href: string;
  /** What the drop from the previous step is called, in the product's own words. */
  lossLabel?: string;
  lossHref?: string;
}

/**
 * The funnel, with the loss between steps drawn as well as the steps.
 *
 * A conventional funnel shows four bars and leaves the reader to subtract. The number
 * that decides what anyone does next is the one *between* the bars — 139 contacted
 * companies that never answered is the finding; "replied: 135" is only the arithmetic
 * that produced it. So each gap is its own line, with its own link.
 */
function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = steps[0]?.value ?? 0;

  // The weakest transition — where outreach actually leaks. Marked rather than merely
  // visible: the eye reads a funnel top-down and the leak is rarely at the top.
  let weakest = -1;
  let weakestRate = Infinity;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].value;
    if (prev < MIN_N) continue;
    const r = steps[i].value / prev;
    if (r < weakestRate) {
      weakestRate = r;
      weakest = i;
    }
  }

  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.value : steps[i - 1].value;
        const ofPrev = prev > 0 ? s.value / prev : 0;
        const lost = i === 0 ? 0 : prev - s.value;
        return (
          <li key={s.label}>
            {i > 0 && (
              <div
                className={cn(
                  "flex items-center gap-2 py-1.5 pl-3 text-[11px]",
                  i === weakest ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn("h-4 w-px", i === weakest ? "w-0.5 bg-foreground" : "bg-border")}
                  aria-hidden
                />
                {lost > 0 ? (
                  s.lossHref ? (
                    <Link href={s.lossHref} className="hover:underline">
                      <span className="tabular-nums" style={MONO}>
                        {lost}
                      </span>{" "}
                      {s.lossLabel}
                    </Link>
                  ) : (
                    <span>
                      <span className="tabular-nums" style={MONO}>
                        {lost}
                      </span>{" "}
                      {s.lossLabel}
                    </span>
                  )
                ) : (
                  <span>no drop-off</span>
                )}
                {i === weakest && (
                  <span className="font-semibold">— the weakest step</span>
                )}
              </div>
            )}

            <Link href={s.href} className="group block rounded-md py-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-foreground underline-offset-4 group-hover:underline">
                  {s.label}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">{s.sub}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground" style={MONO}>
                    {s.value}
                  </span>
                  {i > 0 && (
                    <span
                      className="w-9 text-right text-[11px] tabular-nums text-muted-foreground"
                      style={MONO}
                    >
                      {Math.round(ofPrev * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <span className="mt-1 block h-2 w-full overflow-hidden rounded-[2px] bg-ink-100">
                <span
                  className={cn("horizon-load block h-full rounded-[2px]", s.fill)}
                  style={
                    {
                      width: `${top > 0 ? (s.value / top) * 100 : 0}%`,
                      "--load-delay": `${i * 60}ms`,
                    } as React.CSSProperties
                  }
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Per engagement ────────────────────────────────────────────────────────── */

function EngagementTable({
  rows,
  health,
  projectId,
}: {
  rows: {
    mandate_id: number;
    name: string;
    type: string;
    total_companies: number;
    emails_sent: number;
    responded: number;
    bounced: number;
    response_rate: number;
  }[];
  health: { id: number; overdue_count: number; needs_initial_count: number }[];
  projectId: number;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No engagement activity yet.</p>;
  }
  const healthById = new Map(health.map((h) => [h.id, h]));
  const maxSent = Math.max(1, ...rows.map((r) => r.emails_sent));
  // Ranked by what returned, not by name: the question the section asks is which book
  // is carrying the project, and alphabetical order answers a different one.
  const ordered = [...rows].sort((a, b) => b.responded - a.responded || b.emails_sent - a.emails_sent);

  const link = (mandateId: number, extra?: Parameters<typeof workspaceHref>[1]) =>
    workspaceHref(projectId, {
      ...extra,
      filter: {
        join: "and",
        conditions: [
          { id: "eng", field: "engagement", op: "any_of", values: [mandateId] },
          ...(extra?.filter?.conditions ?? []),
        ],
      },
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[38rem] text-sm">
        <thead>
          <tr className={cn("border-b border-border", LABEL)}>
            <th className="w-[30%] pb-2 text-left font-semibold">Engagement</th>
            <th className="w-[24%] pb-2 text-left font-semibold">Emails sent</th>
            <th className="pb-2 pr-4 text-right font-semibold">Replies</th>
            <th className="hidden pb-2 pr-4 text-right font-semibold sm:table-cell">Bounced</th>
            <th className="pb-2 text-right font-semibold">Waiting on you</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ordered.map((r) => {
            const h = healthById.get(r.mandate_id);
            const thin = isThin(r.total_companies);
            return (
              <tr key={r.mandate_id} className="group hover:bg-muted/60">
                <td className="max-w-0 py-2.5 pr-3 align-middle">
                  <Link href={link(r.mandate_id)} className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded-[3px] px-1 text-[10px] font-medium leading-4",
                        DEAL_TYPE_STYLE[r.type as keyof typeof DEAL_TYPE_STYLE],
                      )}
                    >
                      {DEAL_TYPE_SHORT[r.type as keyof typeof DEAL_TYPE_SHORT]}
                    </span>
                    <span className="truncate underline-offset-4 group-hover:underline">{r.name}</span>
                    <span
                      className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                      style={MONO}
                    >
                      {r.total_companies}
                    </span>
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2">
                    <Bar fraction={r.emails_sent / maxSent} className="flex-1" />
                    <span
                      className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
                      style={MONO}
                    >
                      {r.emails_sent}
                    </span>
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums" style={MONO}>
                  {thin ? (
                    <span
                      className="text-muted-foreground"
                      title={`Only ${r.total_companies} companies — too thin to quote a rate`}
                    >
                      {r.responded}/{r.total_companies}
                    </span>
                  ) : (
                    <>
                      <span className="font-medium">{pctLabel(r.response_rate)}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        {r.responded}/{r.total_companies}
                      </span>
                    </>
                  )}
                </td>
                <td
                  className="hidden py-2.5 pr-4 text-right tabular-nums text-muted-foreground sm:table-cell"
                  style={MONO}
                >
                  {r.bounced || "—"}
                </td>
                <td className="py-2.5 text-right text-[11px] tabular-nums" style={MONO}>
                  {h && h.overdue_count > 0 && (
                    <Link
                      href={link(r.mandate_id, { view: "follow-ups" })}
                      className={cn(LATE_TOKEN, "transition-colors hover:bg-ink-700")}
                    >
                      {h.overdue_count} overdue
                    </Link>
                  )}
                  {h && h.overdue_count > 0 && h.needs_initial_count > 0 && (
                    <span className="text-muted-foreground"> · </span>
                  )}
                  {h && h.needs_initial_count > 0 && (
                    <Link
                      href={link(r.mandate_id, { view: "intro-pending" })}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {h.needs_initial_count} intro
                    </Link>
                  )}
                  {(!h || (h.overdue_count === 0 && h.needs_initial_count === 0)) && (
                    <span className="text-muted-foreground">clear</span>
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

/* ── Segments ──────────────────────────────────────────────────────────────── */

interface SegmentRow {
  key: string;
  label: string;
  total: number;
  responded: number;
  rate: number;
  /** The rows nobody has filed yet — an absence, not a segment. */
  unclassified: boolean;
  href: string;
}

/**
 * Segment performance, with the thin rows kept and demoted rather than hidden.
 *
 * A group of three companies with two replies is 67%, and printing that beside a group
 * of ninety is how a briefing produces a confident wrong answer. But deleting the row
 * is also wrong — the analyst needs to know the segment exists and is under-sampled.
 * So thin rows drop below the rule, keep their raw counts, and lose the percentage.
 */
function SegmentTable({
  rows,
  sort,
  axisNoun,
}: {
  rows: SegmentRow[];
  sort: SegmentSort;
  /** "category" or "band" — used only in the unclassified caption. */
  axisNoun: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing classified yet.</p>;
  }

  // The unfiled bucket is shown but never ranked. It is not a kind of counterparty,
  // it is the absence of one — and letting "Unsorted, 100%" head a list titled "which
  // counterparties answer" states something the data never said. On this book that is
  // 77 companies out of 289, which is itself worth knowing, so it keeps its own line.
  const filed = rows.filter((r) => !r.unclassified);
  const unfiled = rows.filter((r) => r.unclassified);
  const ranked = filed.filter((r) => !isThin(r.total));
  const thin = filed.filter((r) => isThin(r.total));

  const ordered = [...ranked].sort((a, b) => {
    if (sort === "volume") return b.total - a.total || a.label.localeCompare(b.label);
    if (sort === "worst") return a.rate - b.rate || b.total - a.total;
    return b.rate - a.rate || b.total - a.total;
  });

  return (
    <div className="flex flex-col gap-3">
      {ordered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No segment has {MIN_N} companies yet — nothing here is worth ranking.
        </p>
      ) : (
        <ul className="flex flex-col">
          {ordered.map((r) => (
            <li key={r.key}>
              <Link
                href={r.href}
                className="group flex items-center gap-3 rounded-md py-1.5 transition-colors hover:bg-accent"
              >
                <span
                  className="w-36 shrink-0 truncate text-xs text-foreground underline-offset-4 group-hover:underline"
                  title={r.label}
                >
                  {r.label}
                </span>
                <Bar fraction={r.rate} className="h-2 flex-1" />
                <span
                  className="w-24 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
                  style={MONO}
                >
                  <span className="font-medium text-foreground">{pctLabel(r.rate)}</span>{" "}
                  {r.responded}/{r.total}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {unfiled.map((r) => (
        <div key={r.key} className="border-t border-border pt-3">
          <Link
            href={r.href}
            className="group flex items-center gap-3 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <span className="w-36 shrink-0 truncate">Not yet classified</span>
            <Bar fraction={r.rate} className="h-2 flex-1" tone="muted" />
            <span className="w-24 shrink-0 text-right tabular-nums" style={MONO}>
              {r.responded}/{r.total}
            </span>
          </Link>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {r.total} {r.total === 1 ? "company has" : "companies have"} no{" "}
            {axisNoun} on them, so they cannot be compared with the segments above.
          </p>
        </div>
      ))}

      {thin.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className={cn(LABEL, "mb-1.5")}>Too small to rate</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {thin.map((r) => (
              <li key={r.key}>
                <Link
                  href={r.href}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  {r.label}{" "}
                  <span className="tabular-nums" style={MONO}>
                    {r.responded}/{r.total}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Fewer than {MIN_N} companies each — the counts are real, a percentage from
            them would not be.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Distributions ─────────────────────────────────────────────────────────── */

function Distribution({
  title,
  dim,
  unit,
  total,
}: {
  title: string;
  dim: LatencyDimension;
  unit: string;
  total: number;
}) {
  const max = Math.max(1, ...dim.buckets.map((b) => b.count));
  const thin = dim.with_data < MIN_N;

  return (
    // A thin sample recedes by tone — grey bars — never by opacity, which would take
    // its labels below a readable contrast along with it.
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={LABEL}>{title}</h3>
        <span className="text-xs text-muted-foreground">
          median{" "}
          <span className="font-semibold tabular-nums text-foreground" style={MONO}>
            {dim.median == null ? "—" : `${dim.median}${unit}`}
          </span>
        </span>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {dim.buckets.map((b) => (
          <li key={b.label} className="flex items-center gap-2.5">
            <span
              className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
              style={MONO}
            >
              {b.label}
            </span>
            <Bar fraction={b.count / max} className="h-3 flex-1" tone={thin ? "muted" : "brand"} />
            <span
              className="w-6 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
              style={MONO}
            >
              {b.count}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {thin ? (
          <>
            Only{" "}
            <span className="tabular-nums" style={MONO}>
              {dim.with_data}
            </span>{" "}
            {dim.with_data === 1 ? "reply has" : "replies have"} enough history to
            measure — read the shape, not the median.
          </>
        ) : (
          <>
            <span className="tabular-nums" style={MONO}>
              {dim.with_data}
            </span>{" "}
            of {total} replies measured.
          </>
        )}
      </p>
    </div>
  );
}

/* ── Loading ───────────────────────────────────────────────────────────────── */

function BriefingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-2/3 max-w-lg animate-pulse rounded bg-ink-100" />
        <div className="h-12 w-full animate-pulse rounded bg-ink-100" />
      </div>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded bg-ink-100" />
        <div className="h-48 animate-pulse rounded bg-ink-100" />
      </div>
      <div className="h-40 animate-pulse rounded bg-ink-100" />
    </div>
  );
}
