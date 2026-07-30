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
import { cn } from "@/lib/utils";

/** Data numerals use the mono face — true lining tabular figures, desk-ticker feel. */
const MONO = { fontFamily: "var(--font-mono)" };

/** Colour band for an AI fit score (0–100). Pure — unit-tested. */
export function scoreTone(score: number | null | undefined): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-emerald-500/[0.12] text-emerald-800 dark:text-emerald-300";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  if (score >= 20) return "bg-amber-500/[0.12] text-amber-800 dark:text-amber-300";
  return "bg-destructive/[0.12] text-destructive-ink";
}

/** Solid fill for the score meter — matches the tone band. Pure. */
export function scoreFill(score: number | null | undefined): string {
  if (score == null) return "bg-muted-foreground/40";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  if (score >= 20) return "bg-amber-500";
  return "bg-destructive";
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

// Stage dots mirror the funnel board's KIND_ACCENT hues, so the stage chip on a
// pool row and the board column carrying the card share one colour language.
const STAGE_DOT: Record<SourcingStageKind, string> = {
  RESEARCH: "bg-muted-foreground/50",
  SHORTLIST: "bg-primary",
  ACTIVE: "bg-sky-500",
  ENGAGED: "bg-emerald-500",
  PASSED: "bg-muted-foreground/50",
  CUSTOM: "bg-violet-400",
};

// ── Fit rail — the row-level signature. One color-banded score per row; the eye
//    runs down the left edge and reads the whole pool's fit quality in a single
//    sweep. It is the Sourcing desk's answer to the Outreach desk's due token. ────

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
  strong: { text: "text-emerald-500", edge: "bg-emerald-500", bg: "from-emerald-500/[0.15] to-emerald-500/0", caption: "fit" },
  good: { text: "text-emerald-700 dark:text-emerald-400", edge: "bg-emerald-500", bg: "from-emerald-500/[0.14] to-emerald-500/0", caption: "fit" },
  moderate: { text: "text-amber-500", edge: "bg-amber-500", bg: "from-amber-500/[0.14] to-amber-500/0", caption: "fit" },
  weak: { text: "text-primary-ink", edge: "bg-amber-500", bg: "from-amber-500/[0.14] to-amber-500/0", caption: "fit" },
  poor: { text: "text-destructive-ink", edge: "bg-destructive", bg: "from-destructive/[0.14] to-destructive/0", caption: "fit" },
  none: { text: "text-muted-foreground", edge: "bg-muted-foreground/40", bg: "from-muted-foreground/[0.05] to-transparent", caption: "unscored" },
  lowdata: { text: "text-muted-foreground", edge: "bg-muted-foreground/40", bg: "from-muted-foreground/[0.05] to-transparent", caption: "low data" },
};

function FitRail({
  score,
  insufficient,
  index,
  expanded,
  onToggle,
  ariaLabel,
}: {
  score: number | null | undefined;
  insufficient: boolean;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  const band = fitBand(score, insufficient);
  const t = FIT_RAIL[band];
  const showNum = band !== "none" && band !== "lowdata" && score != null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={ariaLabel}
      className={cn(
        "relative flex h-full w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 self-stretch bg-gradient-to-r outline-none transition-[filter] duration-200",
        "group-hover:brightness-115 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        t.bg,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-[3px] rounded-r transition-all duration-200 group-hover:inset-y-1 group-hover:w-1",
          t.edge,
        )}
      />
      {showNum ? (
        <AnimatedNumber
          value={score!}
          delay={Math.min(index, 12) * 22}
          className={cn("text-lg font-bold leading-none tabular-nums", t.text)}
          style={MONO}
        />
      ) : (
        <span className={cn("text-lg font-bold leading-none", t.text)} style={MONO} aria-hidden>
          —
        </span>
      )}
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t.caption}</span>
    </button>
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
      <span className="w-7 shrink-0 text-right tabular-nums text-foreground/80" style={MONO}>
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

  const meta = [
    item.hq,
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
    <div className={cn("overflow-hidden", selected && "bg-primary/[0.05]")}>
      {/* Scannable row */}
      <div
        className={cn(
          "group flex min-h-[58px] items-stretch transition-[background-color] duration-150",
          "hover:bg-primary/[0.045]",
        )}
      >
        <FitRail
          score={cand?.fit_score}
          insufficient={insufficient}
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
                      "border-input hover:border-primary/60",
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
              {cand?.stage_name && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOT[cand.stage_kind ?? "CUSTOM"])}
                    aria-hidden
                  />
                  {cand.stage_name}
                </span>
              )}
              {priorWork > 0 && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 px-1.5 py-px text-[10px] font-medium text-primary-ink"
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
              {meta || "No firmographics yet"}
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
                className="rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-primary/10 hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Star className="h-4 w-4" aria-hidden />
              </button>
            )}
            {onPush && (
              <Button
                size="sm"
                variant="outline"
                aria-label={`Push ${item.company_name} to a deal`}
                className="h-7 text-xs font-normal transition-colors group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground"
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
          {item.website && (
            <a
              href={item.website.startsWith("http") ? item.website : `https://${item.website}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary-ink hover:underline"
            >
              <ExternalLink className="h-3 w-3" aria-hidden /> {item.domain_key ?? item.website}
            </a>
          )}
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
                    className="rounded outline-none hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-ring/50"
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
                      <span className="italic">worked by another team</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!cand?.rationale && !item.website && priorWork === 0 && (
            <p className="text-muted-foreground">No enrichment yet. Score this deal to generate a fit rationale.</p>
          )}
        </div>
      )}
    </div>
  );
}
