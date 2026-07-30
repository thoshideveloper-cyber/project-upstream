/**
 * The product's shared visual vocabulary — one definition per visual role.
 *
 * Why this file exists: the app's surfaces were built in separate redesign tracks
 * (Outreach desk, Master List, Sourcing, Contacts, Projects, Analytics). Each track
 * re-derived the same roles locally, so the same "tiny uppercase label" shipped in
 * 26 spellings, page titles landed on four different scales, and panels mixed three
 * radii with four edge treatments. None of that was a decision — it was drift.
 *
 * Rule: if a role appears on more than one screen, its definition lives here and
 * screens import it. Never re-spell one of these inline; change it here instead.
 *
 * Colour note: everything resolves to a theme token (globals.css). The one
 * deliberate exception is the categorical palette below — deal types and statuses
 * need hues the two-tone amber theme doesn't carry. Those are fixed to a small
 * closed set (emerald / sky / violet / amber / destructive) and are the ONLY
 * non-token hues allowed in the product.
 */

import type { MandateType, CompanyStatus } from "@/types";

/* ── Type ─────────────────────────────────────────────────────────────────── */

/** Titles and figures that carry the brand voice. Never body copy, never labels. */
export const DISPLAY = { fontFamily: "var(--font-display)" } as const;

/** Numerals never sit in the display serif — JetBrains Mono, tabular. */
export const MONO = { fontFamily: "var(--font-mono)" } as const;

/**
 * Page title. One scale for every top-level surface, so moving between Schedule,
 * Analytics and Settings never changes the size of the word in the corner.
 */
export const PAGE_TITLE =
  "text-xl font-semibold tracking-tight text-foreground";
export const PAGE_TITLE_STYLE = { ...DISPLAY, letterSpacing: "-0.02em" } as const;

/**
 * Detail-record title (a company, a contact, a project). Exactly one step up from
 * PAGE_TITLE — a record is a place, a list is a view.
 */
export const RECORD_TITLE =
  "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl";
export const RECORD_TITLE_STYLE = { ...DISPLAY, letterSpacing: "-0.02em" } as const;

/** Sentence under a page or record title. */
export const PAGE_SUBTITLE = "text-sm text-muted-foreground";

/**
 * The micro-label: column heads, field names, panel eyebrows. This is a dense
 * financial tool, so the label tier is genuinely small and genuinely quiet — it
 * exists to be skipped over once the analyst knows the layout.
 */
export const LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

/** LABEL on an accented panel, where muted-foreground would wash out. */
export const LABEL_ON_ACCENT =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-ink";

/** Panel heading — the readable title on a section or card. */
export const PANEL_TITLE = "text-sm font-semibold tracking-tight text-foreground";

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

/**
 * The panel. One radius, one edge, one surface.
 *
 * `ring-1` rather than `border` so an edge never adds a pixel to the box — panels
 * sitting in a grid stay aligned with panels that have none. `ring-border` routes
 * the edge through the single --border token, so light/dark and any future
 * contrast tuning happen in exactly one place.
 */
export const PANEL = "rounded-xl bg-card ring-1 ring-border";

/** PANEL with the standard interior. Use unless the panel manages its own padding. */
export const PANEL_PAD = `${PANEL} p-4`;

/** A recessed panel — for insets inside a PANEL, where bg-card on bg-card is invisible. */
export const PANEL_INSET = "rounded-xl bg-muted/40 ring-1 ring-border";

/** Standard gap between a page's top-level blocks. */
export const PAGE_STACK = "flex flex-col gap-4";

/* ── Controls ─────────────────────────────────────────────────────────────── */

/**
 * Native <select> styled to sit level with <Button size="default">.
 *
 * h-8 is the toolbar height for the whole product. This used to be h-9 on five
 * pages and h-8 on Sourcing, next to h-7/h-8 buttons — so every toolbar had a
 * ragged baseline. One height, one padding, one text size.
 */
export const SELECT_CLS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

/** Column header cell in a dense register table. */
export const TH_CLS = `whitespace-nowrap px-3 py-2 text-left ${LABEL}`;

/**
 * Sticky header cell: solid background + per-cell hairline, so column heads stay
 * put as the register scrolls (the border rides with the cell, which survives
 * border-collapse where a row-level border would not).
 */
export const TH_STICKY = "sticky top-0 z-20 border-b border-border bg-card";

/* ── Categorical palette ──────────────────────────────────────────────────── */

export const DEAL_TYPE_LABEL: Record<MandateType, string> = {
  SELL_SIDE: "Sell-side",
  BUY_SIDE: "Buy-side",
  CAPITAL_RAISE: "Capital raise",
};

export const DEAL_TYPE_SHORT: Record<MandateType, string> = {
  SELL_SIDE: "Sell",
  BUY_SIDE: "Buy",
  CAPITAL_RAISE: "Raise",
};

/** Quiet Linear-style tag — a pastel wash + tinted ink. */
export const DEAL_TYPE_STYLE: Record<MandateType, string> = {
  SELL_SIDE: "bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-300",
  BUY_SIDE: "bg-sky-500/[0.08] text-sky-800 dark:text-sky-300",
  CAPITAL_RAISE: "bg-violet-500/[0.08] text-violet-700/90 dark:text-violet-300/80",
};

/** Solid fill for a deal-type rail / bar / dot. */
export const DEAL_TYPE_BAR: Record<MandateType, string> = {
  SELL_SIDE: "bg-emerald-500",
  BUY_SIDE: "bg-sky-500",
  CAPITAL_RAISE: "bg-violet-500",
};

/** Status dot + label. The single definition — pages import, never redeclare. */
export const STATUS_META: Record<CompanyStatus, { label: string; dot: string }> = {
  NOT_CONTACTED: { label: "Not contacted", dot: "bg-muted-foreground/50" },
  CONTACTED: { label: "Contacted", dot: "bg-sky-500" },
  RESPONDED: { label: "Responded", dot: "bg-emerald-500" },
  INTERESTED: { label: "Interested", dot: "bg-violet-500" },
  DECLINED: { label: "Declined", dot: "bg-amber-500" },
  BOUNCED: { label: "Bounced", dot: "bg-destructive" },
};

/**
 * Outcome tone — for figures and copy that read as good / bad / neutral.
 * Uses the *-ink tokens so small text clears 4.5:1 on both themes (see globals.css).
 */
export const TONE = {
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-destructive-ink",
  attention: "text-primary-ink",
  neutral: "text-muted-foreground",
} as const;

export type Tone = keyof typeof TONE;

/**
 * "Awaiting initial" — a schedule that exists but whose clock hasn't started,
 * because no INITIAL_EMAIL has been logged yet (see CLAUDE.md rule 3).
 *
 * This is the product's sixth semantic colour and it was already used
 * consistently across eight files — it just lived nowhere, so half the sites
 * spelled it `text-indigo-400` with no light-theme variant, which is 2.9:1 on
 * paper. One spelling, both themes.
 */
export const AWAITING_INK = "text-indigo-600 dark:text-indigo-400";
export const AWAITING_DOT = "bg-indigo-500";
export const AWAITING_CHIP =
  "border-indigo-500/30 bg-indigo-500/[0.10] text-indigo-700 dark:text-indigo-300";

/**
 * Fit-score ramp (Sourcing candidates). Four steps over the product's own hues —
 * it used to run lime → orange → red, three families the app speaks nowhere else.
 */
export const SCORE_RAMP = {
  strong: { text: "text-emerald-700 dark:text-emerald-400", fill: "bg-emerald-500" },
  good: { text: "text-emerald-700 dark:text-emerald-400", fill: "bg-emerald-500" },
  weak: { text: "text-primary-ink", fill: "bg-amber-500" },
  poor: { text: "text-destructive-ink", fill: "bg-destructive" },
} as const;

/** The neutral dot — unknown, unset, or not-yet-started. Never a raw gray. */
export const NEUTRAL_DOT = "bg-muted-foreground/50";
