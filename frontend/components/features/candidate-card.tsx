"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  History,
  Send,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import type { SourcingPoolItem, SourcingStageKind } from "@/types";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/features/animated-number";
import { SEGMENT_META } from "@/lib/design";
import { cn } from "@/lib/utils";

/** Data numerals use the mono face — true lining tabular figures, desk-ticker feel. */
const MONO = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * Ink band for an AI fit score (0–100). Pure — unit-tested. A stronger fit is a darker
 * chip; the two strongest bands invert to paper-white type so both clear contrast.
 */
export function scoreTone(score: number | null | undefined): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-ink-900 text-background";
  if (score >= 60) return "bg-ink-700 text-background";
  if (score >= 40) return "bg-ink-200 text-foreground";
  if (score >= 20) return "bg-ink-100 text-foreground";
  return "bg-card text-muted-foreground ring-1 ring-inset ring-border";
}

/** Solid fill for the score meter — the same ladder as the tone band. Pure. */
export function scoreFill(score: number | null | undefined): string {
  if (score == null) return "bg-ink-200";
  if (score >= 80) return "bg-ink-900";
  if (score >= 60) return "bg-ink-700";
  if (score >= 40) return "bg-ink-400";
  if (score >= 20) return "bg-ink-300";
  return "bg-ink-200";
}

/** Compact revenue label. */
export function revLabel(rev: string | null): string {
  if (!rev) return "—";
  const n = Number(rev);
  if (Number.isNaN(n)) return rev;
  return `₹${n.toLocaleString("en-IN")} Cr`;
}

// Warm-history statuses in the analyst's words, never raw enums.
const WARM_STATUS_LABEL: Record<string, string> = {
  NOT_CONTACTED: "Not contacted",
  CONTACTED: "Contacted",
  RESPONDED: "Responded",
  INTERESTED: "Interested",
  DECLINED: "Declined",
  BOUNCED: "Bounced",
};

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Compact human date for a warm touch: "7 Jun 2026". */
function fmtTouch(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH[m - 1]} ${y}`;
}

// Stage glyphs mirror the funnel board's KIND_ACCENT, so the stage chip on a pool row
// and the board column carrying the card share one mark: a Harvey ball that fills as
// the stage advances, grey once a target is passed on.
const STAGE_DOT: Record<SourcingStageKind, string> = {
  RESEARCH: "hb hb-0",
  SHORTLIST: "hb hb-25",
  ACTIVE: "hb hb-50",
  ENGAGED: "hb hb-100",
  PASSED: "hb hb-mute",
  CUSTOM: "hb hb-75",
};

// ── Fit rail — the row-level signature. One ink-banded score per row; the eye runs
//    down the left edge and reads the whole pool's fit quality in a single sweep:
//    the darker the rail, the stronger the fit. ─────────────────────────────────────

type FitBand = "strong" | "good" | "moderate" | "weak" | "poor" | "none" | "lowdata";

function fitBand(score: number | null | undefined, insufficient: boolean): FitBand {
  if (insufficient) return "lowdata";
  if (score == null) return "none";
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "moderate";
  if (score >= 20) return "weak";
  return "poor";
}

const FIT_RAIL: Record<FitBand, { text: string; edge: string; bg: string; caption: string }> = {
  strong: { text: "font-semibold text-foreground", edge: "bg-ink-900", bg: "from-foreground/[0.07] to-transparent", caption: "fit" },
  good: { text: "text-foreground", edge: "bg-ink-700", bg: "from-foreground/[0.05] to-transparent", caption: "fit" },
  moderate: { text: "text-foreground", edge: "bg-ink-400", bg: "from-foreground/[0.03] to-transparent", caption: "fit" },
  weak: { text: "text-muted-foreground", edge: "bg-ink-300", bg: "from-foreground/[0.02] to-transparent", caption: "fit" },
  poor: { text: "text-muted-foreground", edge: "bg-ink-200", bg: "from-transparent to-transparent", caption: "fit" },
  none: { text: "text-muted-foreground", edge: "bg-ink-200", bg: "from-transparent to-transparent", caption: "unscored" },
  lowdata: { text: "text-muted-foreground", edge: "bg-ink-200", bg: "from-transparent to-transparent", caption: "low data" },
};

function FitRail({
  score,
  insufficient,
  segment,
  index,
  expanded,
  onToggle,
  ariaLabel,
}: {
  score: number | null | undefined;
  insufficient: boolean;
  /** Fallback content: with no score, the column says which side of the market this is. */
  segment: SourcingPoolItem["segment"];
  index: number;
  expanded: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  const band = fitBand(score, insufficient);
  const t = FIT_RAIL[band];
  const showNum = band !== "none" && band !== "lowdata" && score != null;
  // An unscored row used to spend 58px of the most prominent column on an em dash. A
  // company's segment is known from the moment it enters the database, so the column
  // carries that instead and the list stays scannable by side of the market.
  const seg = !showNum && band !== "lowdata" && segment ? SEGMENT_META[segment] : null;
  // No stripe and no wash: the score is the signal, set as a number in its own column,
  // so the column needs no coloured edge to say how strong the fit is.
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={ariaLabel}
      // No `h-full`: height:100% resolves against the row's *min*-height, which is
      // indefinite, and setting any height at all opts the item out of `align-self:
      // stretch`. The button then shrink-wrapped its text and sat at the top of the row.
      // self-stretch alone gives it the row's full height, which is what centres it.
      className={cn(
        "relative flex w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 self-stretch border-r border-border outline-none transition-colors duration-150",
        "hover:bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      {showNum ? (
        <AnimatedNumber
          value={score!}
          delay={Math.min(index, 12) * 22}
          className={cn("text-lg font-bold leading-none tabular-nums", t.text)}
          style={MONO}
        />
      ) : seg ? (
        // Token alone: a caption under 25 identical tokens is 25 repetitions of a word
        // the colour and the glyph already say.
        <span
          className={cn("text-sm font-bold leading-none tracking-tight", seg.ink)}
          style={MONO}
          title={`${seg.label} — side of the market`}
        >
          {seg.token}
        </span>
      ) : (
        <span className={cn("text-lg font-bold leading-none", t.text)} style={MONO} aria-hidden>
          —
        </span>
      )}
      {!seg && (
        <span className="text-xs font-medium text-muted-foreground">
          {t.caption}
        </span>
      )}
    </button>
  );
}

/**
 * One field of the record, blank included.
 *
 * An em dash is the point: on a database that ships with names and cities but no
 * financials, showing which fields are empty is what tells an analyst whether to trust
 * the row or go enrich it.
 */
function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const empty = value == null || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate",
          empty ? "text-muted-foreground" : "text-foreground",
          mono && "tabular-nums",
        )}
        style={mono ? MONO : undefined}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

/** One AI subscore as a labelled mini-meter — the components behind the fit number. */
function SubscoreMeter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate capitalize text-muted-foreground">{label.replace(/_/g, " ")}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", scoreFill(v))} style={{ width: `${Math.max(3, v)}%` }} />
      </span>
      <span className="w-7 shrink-0 text-right tabular-nums text-secondary-foreground" style={MONO}>
        {v}
      </span>
    </div>
  );
}

interface Props {
  item: SourcingPoolItem;
  index?: number;
  onPush?: (item: SourcingPoolItem) => void;
  onShortlist?: (item: SourcingPoolItem) => void;
  onFeedback?: (candidateId: number, vote: "UP" | "DOWN") => void;
  selectable?: boolean;
  selected?: boolean;
  /** While a selection exists, every checkbox stays visible (discoverability). */
  anySelected?: boolean;
  onToggleSelect?: (profileId: number) => void;
  /** Controlled expansion (page-owned, enables the `e` shortcut); falls back to internal state. */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * One pool entry as a dense ledger row: a color-banded fit rail on the left, the
 * company's identity and firmographics in the body, and quiet actions on the
 * right that fill amber on row hover (the Outreach desk idiom). The rail doubles
 * as the expand toggle — opening the "why" behind the score (AI rationale with
 * subscores, feedback, warm history). Keeps the whole page scannable
 * top-to-bottom instead of a stack of separate cards.
 */
export function CandidateRow({
  item,
  index = 0,
  onPush,
  onShortlist,
  onFeedback,
  selectable,
  selected,
  anySelected,
  onToggleSelect,
  expanded: expandedProp,
  onToggleExpand,
}: Props) {
  const [innerExpanded, setInnerExpanded] = useState(false);
  const expanded = expandedProp ?? innerExpanded;
  const toggle = () => (onToggleExpand ? onToggleExpand() : setInnerExpanded((e) => !e));

  const cand = item.candidate;
  const warm = item.warm_history ?? [];
  const priorWork = warm.length;
  const insufficient = !!cand?.insufficient_data;
  const scored = cand?.fit_score != null && !insufficient;
  const subscores = scored ? Object.entries(cand?.subscores ?? {}) : [];
  const segMeta = item.segment ? SEGMENT_META[item.segment] : null;

  // What the row can honestly say. On a firm's first day that is a city, a sector and a
  // domain; revenue and headcount join in as imports enrich the record. Ordered
  // identity-first so the line reads the same whether it has three facts or five.
  const meta = [
    item.hq,
    item.sector,
    item.domain_key,
    item.revenue_inr_cr ? revLabel(item.revenue_inr_cr) : null,
    item.headcount ? `${item.headcount.toLocaleString("en-IN")} staff` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const railLabel = insufficient
    ? `${item.company_name} — too little data to score. ${expanded ? "Hide" : "Show"} details.`
    : scored
      ? `${item.company_name} — fit ${cand!.fit_score} of 100. ${expanded ? "Hide" : "Show why"}.`
      : `${item.company_name} — not scored yet. ${expanded ? "Hide" : "Show"} details.`;

  return (
    <div className={cn("overflow-hidden", selected && "bg-subtle")}>
      {/* Scannable row */}
      <div
        className={cn(
          "group flex min-h-[58px] items-stretch transition-[background-color] duration-150",
          "hover:bg-subtle",
        )}
      >
        <FitRail
          score={cand?.fit_score}
          insufficient={insufficient}
          segment={item.segment}
          index={index}
          expanded={expanded}
          onToggle={toggle}
          ariaLabel={railLabel}
        />

        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:px-4">
          {selectable && (
            <button
              type="button"
              onClick={() => onToggleSelect?.(item.profile_id)}
              aria-label={selected ? `Deselect ${item.company_name}` : `Select ${item.company_name}`}
              aria-pressed={!!selected}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? "scale-110 border-primary bg-primary text-primary-foreground"
                  : cn(
                      "border-input hover:border-border-strong",
                      anySelected ? "opacity-60" : "opacity-0 group-hover:opacity-100",
                    ),
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
            </button>
          )}

          <div className="min-w-0 flex-1">
            {/* Line 1 — identity + signals. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-semibold text-foreground">{item.company_name}</span>
              {/* The rail carries the segment only while there is no score to show. When a
                  score takes the column, the fact moves here — stated exactly once. */}
              {segMeta && (scored || insufficient) && (
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-px text-xs font-medium",
                    segMeta.chip,
                  )}
                  title={`${segMeta.label} — side of the market`}
                >
                  {segMeta.token}
                </span>
              )}
              {cand?.stage_name && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-px text-xs font-medium text-muted-foreground">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOT[cand.stage_kind ?? "CUSTOM"])}
                    aria-hidden
                  />
                  {cand.stage_name}
                </span>
              )}
              {priorWork > 0 && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-strong px-1.5 py-px text-[10px] font-medium text-primary-ink"
                  title={`Worked before in ${priorWork} engagement${priorWork > 1 ? "s" : ""}`}
                >
                  <History className="h-3 w-3" aria-hidden />
                  <span className="tabular-nums" style={MONO}>
                    {priorWork}
                  </span>{" "}
                  prior
                </span>
              )}
            </div>
            {/* Line 2 — recessive firmographics. */}
            <div className="mt-0.5 truncate text-xs text-muted-foreground" style={MONO}>
              {meta || "Name only — no research on file"}
            </div>
          </div>

          {/* Actions — quiet until the row is hovered, then Push fills amber. */}
          <div className="flex shrink-0 items-center gap-1">
            {onShortlist && cand?.stage_kind !== "SHORTLIST" && (
              <button
                type="button"
                onClick={() => onShortlist(item)}
                title="Shortlist — add to this deal's funnel"
                aria-label={`Shortlist ${item.company_name}`}
                className="rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Star className="h-4 w-4" aria-hidden />
              </button>
            )}
            {onPush && (
              <Button
                size="sm"
                variant="outline"
                aria-label={`Push ${item.company_name} to a deal`}
                className="h-7 text-xs font-normal transition-colors group-hover:border-border-strong group-hover:bg-primary group-hover:text-primary-foreground"
                onClick={() => onPush(item)}
              >
                <Send className="h-3 w-3 sm:mr-1" aria-hidden />
                <span className="hidden sm:inline">Push</span>
              </Button>
            )}
            <button
              type="button"
              onClick={toggle}
              className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={expanded ? "Hide details" : "Show details"}
              aria-expanded={expanded}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* The "why" — revealed by the rail. */}
      {expanded && (
        <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-3 pl-[62px] text-xs">
          {/* The record card: every fact the database holds, blanks included. An analyst
              about to make a call needs to see the gaps as clearly as the facts. */}
          {/* Three columns, not four: a real HQ string is "Fargo, North Dakota, United
              States" and a quarter of the row ellipsised it. */}
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Side" value={segMeta?.label} />
            <Fact label="Sector" value={item.sector} />
            <Fact label="HQ" value={item.hq} />
            <Fact
              label="Revenue"
              value={item.revenue_inr_cr ? revLabel(item.revenue_inr_cr) : null}
              mono
            />
            <Fact
              label="Headcount"
              value={item.headcount ? item.headcount.toLocaleString("en-IN") : null}
              mono
            />
            <Fact
              label="Website"
              value={
                item.website ? (
                  <a
                    href={item.website.startsWith("http") ? item.website : `https://${item.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-ink hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden />
                    {item.domain_key ?? item.website}
                  </a>
                ) : null
              }
            />
            {item.linkedin && (
              <Fact
                label="LinkedIn"
                value={
                  <a
                    href={item.linkedin.startsWith("http") ? item.linkedin : `https://${item.linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-ink hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden /> profile
                  </a>
                }
              />
            )}
          </dl>
          {cand?.rationale && (
            <div className="rounded-lg bg-card/70 p-2.5">
              <p className="text-muted-foreground">
                <Sparkles className="mr-1 inline h-3 w-3 text-primary-ink" aria-hidden /> {cand.rationale}
              </p>
              {subscores.length > 0 && (
                <div className="mt-2.5 max-w-sm space-y-1.5">
                  {subscores.map(([k, v]) => (
                    <SubscoreMeter key={k} label={k} value={v} />
                  ))}
                </div>
              )}
              {onFeedback && cand.id && (
                <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                  <span className="text-[10px]">Was this fit right?</span>
                  <button
                    onClick={() => onFeedback(cand.id, "UP")}
                    aria-label="Fit looks right"
                    className="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <ThumbsUp className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    onClick={() => onFeedback(cand.id, "DOWN")}
                    aria-label="Fit looks wrong"
                    className="rounded outline-none hover:text-destructive-ink focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <ThumbsDown className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          )}
          {priorWork > 0 && (
            <div>
              <div className="mb-1 font-medium text-muted-foreground">Warm history</div>
              <ul className="space-y-1">
                {warm.map((w, i) => (
                  <li key={i} className="text-muted-foreground">
                    {w.visible ? (
                      <>
                        {w.client_name ?? w.mandate_name} — {w.status ? WARM_STATUS_LABEL[w.status] ?? w.status : "—"}
                        {w.sentiment ? `, ${w.sentiment.toLowerCase()}` : ""}
                        {w.poc ? ` · ${w.poc}` : ""}
                        {w.last_touch ? ` · last touch ${fmtTouch(w.last_touch)}` : ""}
                      </>
                    ) : (
                      <span>worked by another team</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!cand?.rationale && priorWork === 0 && (
            <p className="text-muted-foreground">
              {onShortlist
                ? "No fit rationale yet — score this company against the open deal to generate one."
                : "Firm research only. Open an engagement to score this company against a thesis."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
