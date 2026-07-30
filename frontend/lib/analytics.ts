/**
 * Analytics — shared, pure, deterministic helpers.
 *
 * The trust layer for the Analytics flagship (and the Dashboard KPI). Two jobs:
 *   1. One definition of "reply rate" = replied ÷ contacted, used app-wide so no
 *      surface quietly counts never-contacted companies against you.
 *   2. Low-n recession — a rate over a tiny sample is noise, not signal. Rows below
 *      MIN_N are separated out, never ranked, never "best/worst" in a finding.
 *
 * Honest-signals doctrine (inherited from schedule/page.tsx): nothing here predicts.
 * Every derived line is a re-read of real fields, and every rate ships its denominator.
 */

import type { OverviewStats, TimeseriesPoint, CategoryRow, LayerRow } from "@/hooks/use-analytics";

/** Below this denominator a rate is treated as thin data — shown, but never ranked. */
export const MIN_N = 5;

export function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** replied ÷ contacted, clamped. The one true reply-rate definition. */
export function replyRate(contacted: number, replied: number): number {
  return contacted > 0 ? replied / contacted : 0;
}

// ── Status-derived counts (the outreach outcome vocabulary) ────────────────────

type Status = Record<string, number>;

/** Everyone we've actually reached out to (excludes the never-contacted). */
export function contactedCount(byStatus: Status, total: number): number {
  return Math.max(0, total - (byStatus.NOT_CONTACTED ?? 0));
}

/** Any reply — positive, negative, or unclassified. */
export function repliedCount(byStatus: Status): number {
  return (byStatus.RESPONDED ?? 0) + (byStatus.INTERESTED ?? 0) + (byStatus.DECLINED ?? 0);
}

export function interestedCount(byStatus: Status): number {
  return byStatus.INTERESTED ?? 0;
}

export function bouncedCount(byStatus: Status): number {
  return byStatus.BOUNCED ?? 0;
}

// ── Book composition (coverage before rate) ───────────────────────────────────

export interface BookComposition {
  /** Companies that answered. */
  replied: number;
  /** Emailed, still silent. */
  noReply: number;
  /** Never emailed at all. */
  untouched: number;
}

/**
 * Split a book into the three states a partner reads before any rate: answered,
 * chased-but-silent, and never touched. Clamped at zero so a stale or partial
 * payload can never render a negative bar segment.
 */
export function bookComposition(input: {
  total: number;
  contacted: number;
  replied: number;
}): BookComposition {
  const total = Math.max(0, input.total);
  const contacted = Math.min(Math.max(0, input.contacted), total);
  const replied = Math.min(Math.max(0, input.replied), contacted);
  return {
    replied,
    noReply: contacted - replied,
    untouched: total - contacted,
  };
}

// ── Low-n recession ────────────────────────────────────────────────────────────

export interface RateRow {
  label: string;
  total: number;
  responded: number;
  /** Fraction 0..1. */
  rate: number;
  /** Optional drill-through for the row. */
  href?: string;
}

/** True when this row's sample is too thin to trust its rate. */
export function isThin(total: number): boolean {
  return total < MIN_N;
}

/**
 * Split rate rows into ranked (healthy-n, sorted best→worst) and thin (n<MIN_N,
 * sorted by size so the least-thin sits first). Callers render `ranked` normally
 * and `thin` recessed under a "thin data" note — thin rows never get a rank number
 * and never win a finding.
 */
export function partitionRates(rows: RateRow[]): { ranked: RateRow[]; thin: RateRow[] } {
  const ranked = rows.filter((r) => r.total >= MIN_N).sort((a, b) => b.rate - a.rate);
  const thin = rows.filter((r) => r.total < MIN_N).sort((a, b) => b.total - a.total);
  return { ranked, thin };
}

// ── Period trend (from the timeseries window) ─────────────────────────────────

export interface PeriodTrend {
  recentWeeks: number;
  olderWeeks: number;
  sentRecent: number;
  sentOlder: number;
  respRecent: number;
  respOlder: number;
  /** responses ÷ emails-sent in each half, as a fraction. */
  flowRateRecent: number;
  flowRateOlder: number;
  /** flowRateRecent − flowRateOlder, in percentage points (rounded). */
  deltaPts: number;
  /** True only when both halves carry volume, so a delta is meaningful. */
  comparable: boolean;
}

export function periodTrend(series: TimeseriesPoint[]): PeriodTrend {
  const half = Math.floor(series.length / 2);
  const older = series.slice(0, half);
  const recent = series.slice(half);
  const sum = (arr: TimeseriesPoint[], k: "sent" | "responses") => arr.reduce((n, x) => n + x[k], 0);
  const sentRecent = sum(recent, "sent");
  const sentOlder = sum(older, "sent");
  const respRecent = sum(recent, "responses");
  const respOlder = sum(older, "responses");
  const flowRateRecent = sentRecent ? respRecent / sentRecent : 0;
  const flowRateOlder = sentOlder ? respOlder / sentOlder : 0;
  return {
    recentWeeks: recent.length,
    olderWeeks: older.length,
    sentRecent,
    sentOlder,
    respRecent,
    respOlder,
    flowRateRecent,
    flowRateOlder,
    deltaPts: Math.round(flowRateRecent * 100) - Math.round(flowRateOlder * 100),
    comparable: sentRecent > 0 && sentOlder > 0,
  };
}

// ── The Finding line — a deterministic thesis, min-sample gated ────────────────

export type FindingTone = "neutral" | "positive" | "warning";

export interface Finding {
  id: string;
  /** The plain sentence (set in the display serif at the headline). */
  text: string;
  tone: FindingTone;
  /** Higher = more worth leading with. */
  salience: number;
  /** Optional drill-through to the thing the finding names. */
  href?: string;
  cta?: string;
}

export interface FindingInputs {
  overview?: OverviewStats;
  series: TimeseriesPoint[];
  weeks: number;
  categories: CategoryRow[];
  layers: LayerRow[];
}

/**
 * Rank candidate findings over data already on the page. Never fabricates a
 * prediction and never builds a claim on n<MIN_N. Returns findings sorted by
 * salience (headline first). Empty when there's nothing honest to say.
 */
export function buildFindings({ overview, series, weeks, categories, layers }: FindingInputs): Finding[] {
  const out: Finding[] = [];
  if (!overview) return out;

  const byStatus = overview.by_status ?? {};
  const contacted = contactedCount(byStatus, overview.total);
  const replied = repliedCount(byStatus);
  const rate = replyRate(contacted, replied);

  // 1. Reply-rate baseline — always available once anyone's been contacted.
  if (contacted > 0) {
    out.push({
      id: "reply-rate",
      text: `${replied} of the ${contacted} companies contacted have replied — a ${pctLabel(rate)} reply rate.`,
      tone: replied > 0 ? "positive" : "neutral",
      salience: 20 + Math.round(rate * 100) * 0.2,
    });
  }

  // 2. Overdue health — a direct call to action, scaled by how many are slipping.
  const overdue = overview.overdue ?? 0;
  if (overdue > 0) {
    out.push({
      id: "overdue",
      text: `${overdue} ${overdue === 1 ? "company is" : "companies are"} overdue a follow-up.`,
      tone: "warning",
      salience: 42 + Math.min(overdue, 40),
      href: "/schedule",
      cta: "Work the queue",
    });
  }

  // 3. Needs-first — outreach that hasn't even started.
  const needsFirst = overview.needs_initial ?? 0;
  if (needsFirst > 0) {
    out.push({
      id: "needs-first",
      text: `${needsFirst} ${needsFirst === 1 ? "company has" : "companies have"} never been emailed.`,
      tone: "warning",
      salience: 30 + Math.min(needsFirst, 30),
      href: "/schedule",
      cta: "Send first emails",
    });
  }

  // 4. Segment leader vs laggard — healthy-n only, salience by the spread.
  const segRows: RateRow[] = [
    ...categories.map((c) => ({ label: c.category, total: c.total, responded: c.responded, rate: c.response_rate })),
    ...layers.map((l) => ({ label: l.layer, total: l.total, responded: l.responded, rate: l.response_rate })),
  ];
  const { ranked } = partitionRates(segRows);
  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const spread = Math.round(best.rate * 100) - Math.round(worst.rate * 100);
    if (spread > 0) {
      out.push({
        id: "segment",
        text: `${best.label} replies most often (${pctLabel(best.rate)} · ${best.responded}/${best.total}); ${worst.label} lags (${pctLabel(worst.rate)} · ${worst.responded}/${worst.total}).`,
        tone: "neutral",
        salience: 26 + spread * 0.5,
      });
    }
  }

  // 5. Trend — reply volume this window vs the prior equal window.
  const t = periodTrend(series);
  if (t.comparable) {
    const diff = t.respRecent - t.respOlder;
    const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    if (diff !== 0) {
      out.push({
        id: "trend",
        text: `Replies are ${dir} — ${t.respRecent} in the last ${t.recentWeeks} weeks vs ${t.respOlder} in the ${t.olderWeeks} before.`,
        tone: diff > 0 ? "positive" : "warning",
        salience: 22 + Math.min(Math.abs(diff), 30),
      });
    }
  }

  return out.sort((a, b) => b.salience - a.salience);
}
