/**
 * The product's shared visual vocabulary — one definition per visual role.
 *
 * Rule: if a role appears on more than one screen, its definition lives here and
 * screens import it. Never re-spell one of these inline; change it here instead.
 *
 * Colour rule (see globals.css "Ledger"): the interface is black, white and cool
 * neutrals. Colour appears only as STATE, from four families that mean the same thing
 * everywhere —
 *
 *   • danger  (red)    late, bounced, failed, destructive
 *   • warning (amber)  due soon, blocked, needs a decision
 *   • success (green)  replied, interested, done
 *   • info    (blue)   contacted, in progress
 *
 * Every coloured mark is paired with a shape (the status glyph) or a word, so no state
 * is carried by hue alone. A raw palette class (emerald-500, sky-100…) anywhere in the
 * app is a regression: use these roles or the `*-danger` / `*-success` tokens.
 */

import type {
  MandateType,
  CompanyStatus,
  TaskPriority,
  TaskStatus,
} from "@/types";

/* ── Type ─────────────────────────────────────────────────────────────────── */

/** Titles. The same family as the body — weight and size carry the hierarchy. */
export const DISPLAY = { fontFamily: "var(--font-sans)" } as const;

/**
 * Figures. Tabular lining numerals in the UI face, so columns of numbers align and a
 * count refreshing never shifts its neighbours. (Kept as a style object because it is
 * spread onto ~200 call sites; the name predates the switch away from a mono face.)
 */
export const MONO = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * Page title. One scale for every top-level surface, so moving between Schedule,
 * Analytics and Settings never changes the size of the word in the corner.
 */
export const PAGE_TITLE = "text-xl font-semibold text-foreground";
export const PAGE_TITLE_STYLE = { letterSpacing: "-0.015em" } as const;

/**
 * Detail-record title (a company, a contact, a project). One step up from PAGE_TITLE —
 * a record is a place, a list is a view.
 */
export const RECORD_TITLE = "text-2xl font-semibold text-foreground";
export const RECORD_TITLE_STYLE = { letterSpacing: "-0.02em" } as const;

/** Sentence under a page or record title. */
export const PAGE_SUBTITLE = "text-sm text-muted-foreground";

/**
 * The label tier: column heads, field names, group captions. Sentence case at 12px —
 * small and quiet enough to be skipped once the layout is learned, but set in words
 * rather than tracked capitals, so a dense screen does not shout its own furniture.
 */
export const LABEL = "text-xs font-medium text-muted-foreground";

/** LABEL on a filled panel, where the muted grey would sink into the fill. */
export const LABEL_ON_ACCENT = "text-xs font-medium text-foreground";

/** Panel heading — the readable title on a section. */
export const PANEL_TITLE = "text-sm font-semibold text-foreground";

/** A text link: ink on a hairline underline that darkens under the pointer. */
export const INK_LINK =
  "font-medium text-foreground underline decoration-border-strong decoration-1 underline-offset-[3px] transition-colors hover:decoration-foreground focus-visible:outline-none focus-visible:decoration-ring focus-visible:decoration-2";

/** Keyboard key cap — for the shortcut hints the keyboard-first screens print. */
export const KBD =
  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border bg-muted px-1 font-sans text-[11px] font-medium leading-none text-muted-foreground";

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

/**
 * The panel: white, one hairline, 8px corners, no shadow. Panels are structure, not
 * elevation — only things that float over the page (menus, dialogs, sheets) cast one.
 *
 * `ring-1` rather than `border` so an edge never adds a pixel to the box — panels
 * sitting in a grid stay aligned with panels that have none.
 */
export const PANEL = "rounded-lg bg-card ring-1 ring-border";

/** PANEL with the standard interior. Use unless the panel manages its own padding. */
export const PANEL_PAD = `${PANEL} p-4`;

/** A recessed well — for insets inside a PANEL, where white on white is invisible. */
export const PANEL_INSET = "rounded-lg bg-muted ring-1 ring-border";

/** The header strip of a panel: title left, action right, hairline below. */
export const PANEL_HEAD =
  "flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-2";

/** Standard gap between a page's top-level blocks. */
export const PAGE_STACK = "flex flex-col gap-5";

/* ── Controls ─────────────────────────────────────────────────────────────── */

/** Native <select> styled to sit level with <Button size="default"> (h-8). */
export const SELECT_CLS =
  "h-8 rounded-md border border-input bg-card px-2.5 text-sm text-foreground shadow-xs outline-none transition-colors hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

/** Column header cell in a dense register table. */
export const TH_CLS =
  "h-9 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground";

/** Sticky header cell: solid ground + hairline, so rows never show through. */
export const TH_STICKY = "sticky top-0 z-20 border-b border-border bg-muted";

/**
 * The segmented control — two to four mutually exclusive choices.
 *
 * A recessed track with the current segment raised in white: the standard idiom, so it
 * reads as "one of these" without a legend, and it never competes with the page's one
 * black primary action.
 */
export const SEG_GROUP =
  "inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5 ring-1 ring-inset ring-border";
export const SEG_ITEM =
  "inline-flex h-full items-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
export const SEG_ITEM_ON = "bg-card text-foreground shadow-sm ring-1 ring-border";
export const SEG_ITEM_OFF = "text-muted-foreground hover:text-foreground";

/** A pressable filter chip (on or off). Pressed = ink. */
export const TOGGLE_ON = "border-foreground bg-foreground font-medium text-background";
export const TOGGLE_OFF =
  "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground";

/* ── Chips ────────────────────────────────────────────────────────────────── */

/**
 * The chip: a small square-cornered tag. Square rather than a pill, so a row of them
 * reads as data, not as buttons, and a table never turns into pill soup.
 */
export const CHIP =
  "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] px-1.5 text-xs font-medium leading-none ring-1 ring-inset";

export const CHIP_TONE = {
  neutral: "bg-muted text-secondary-foreground ring-border",
  outline: "bg-card text-foreground ring-border",
  ink: "bg-foreground text-background ring-foreground",
  danger: "bg-danger-soft text-danger-ink ring-danger-line",
  warning: "bg-warning-soft text-warning-ink ring-warning-line",
  success: "bg-success-soft text-success-ink ring-success-line",
  info: "bg-info-soft text-info-ink ring-info-line",
} as const;

export type ChipTone = keyof typeof CHIP_TONE;

/* ── The alarm ────────────────────────────────────────────────────────────── */

/**
 * "12d late" — the one mark in the product that is allowed to shout. Red on a soft red
 * ground, reserved for time that has already been lost (an overdue follow-up, an overdue
 * task), so it never has to compete with itself.
 */
export const LATE_TOKEN =
  "inline-flex items-center rounded-[4px] bg-danger-soft px-1.5 py-px text-xs font-semibold leading-4 tabular-nums text-danger-ink ring-1 ring-inset ring-danger-line";

/** "3d" / "today" — due inside the window. Amber, one step quieter than late. */
export const DUE_TOKEN =
  "inline-flex items-center rounded-[4px] bg-warning-soft px-1.5 py-px text-xs font-medium leading-4 tabular-nums text-warning-ink ring-1 ring-inset ring-warning-line";

/* ── Deal sides & segments ────────────────────────────────────────────────── */

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

/**
 * The deal-side tag. One neutral treatment for all three: the word itself ("Sell",
 * "Buy", "Raise") is the distinction, and it is legible without a key. A side is a
 * category, not a state, so it takes no colour.
 */
const SIDE_TAG =
  "border border-border bg-muted font-semibold uppercase tracking-[0.04em] text-secondary-foreground";
export const DEAL_TYPE_STYLE: Record<MandateType, string> = {
  SELL_SIDE: SIDE_TAG,
  BUY_SIDE: SIDE_TAG,
  CAPITAL_RAISE: SIDE_TAG,
};

/**
 * Solid fill for a deal side inside a bar. Three steps of the ink ladder, darkest
 * first, in the order the product always names the sides (sell, buy, raise).
 */
export const DEAL_TYPE_BAR: Record<MandateType, string> = {
  SELL_SIDE: "bg-ink-900",
  BUY_SIDE: "bg-ink-500",
  CAPITAL_RAISE: "bg-ink-300",
};

/**
 * Pool segment — which side of the market a company sits on. The same three steps as
 * the deal sides: a sell-side deal and the targets it sources from are both the darkest
 * ink, a buy-side deal and its buyers the middle step, a raise and its investors the
 * lightest. One scale, one meaning, everywhere.
 */
export const SEGMENT_META: Record<
  "TARGET" | "BUYER" | "INVESTOR",
  { label: string; plural: string; token: string; chip: string; bar: string; ink: string }
> = {
  TARGET: {
    label: "Target",
    plural: "Targets",
    token: "TGT",
    chip: "border border-border bg-muted text-secondary-foreground",
    bar: "bg-ink-900",
    ink: "text-foreground",
  },
  BUYER: {
    label: "Buyer",
    plural: "Buyers",
    token: "BUY",
    chip: "border border-border bg-muted text-secondary-foreground",
    bar: "bg-ink-500",
    ink: "text-foreground",
  },
  INVESTOR: {
    label: "Investor",
    plural: "Investors",
    token: "INV",
    chip: "border border-border bg-muted text-secondary-foreground",
    bar: "bg-ink-300",
    ink: "text-foreground",
  },
};

/* ── Company status ───────────────────────────────────────────────────────── */

/**
 * Status glyph + label. The single definition — pages import, never redeclare.
 *
 * `dot` is the status glyph (`.hb` in globals.css): the FILL is how far the company has
 * come, the COLOUR is the kind of state. `ink` is the label's text treatment.
 */
export const STATUS_META: Record<CompanyStatus, { label: string; dot: string; ink: string }> = {
  NOT_CONTACTED: { label: "Not contacted", dot: "hb hb-0", ink: "text-muted-foreground" },
  CONTACTED: { label: "Contacted", dot: "hb hb-25 hb-info", ink: "text-foreground" },
  RESPONDED: { label: "Responded", dot: "hb hb-50 hb-success", ink: "text-foreground" },
  INTERESTED: { label: "Interested", dot: "hb hb-100 hb-success", ink: "font-medium text-success-ink" },
  DECLINED: { label: "Declined", dot: "hb hb-mute", ink: "text-muted-foreground" },
  BOUNCED: { label: "Bounced", dot: "hb hb-void hb-danger", ink: "text-danger-ink" },
};

/** Outcome tone — for figures and copy that read as good / bad / neutral. */
export const TONE = {
  positive: "text-success-ink",
  negative: "font-medium text-danger-ink",
  attention: "font-medium text-warning-ink",
  neutral: "text-muted-foreground",
} as const;

export type Tone = keyof typeof TONE;

/**
 * "Awaiting initial" — a schedule that exists but whose clock hasn't started, because
 * no INITIAL_EMAIL has been logged yet (see CLAUDE.md rule 3). Drawn with the dashed
 * glyph: the record exists, nothing has gone out.
 */
export const AWAITING_INK = "text-secondary-foreground";
export const AWAITING_DOT = "hb hb-dashed";
export const AWAITING_CHIP = "border-dashed border-border-strong bg-card text-foreground";

/** Fit-score ramp (Sourcing candidates). Darker ink = a stronger fit. */
export const SCORE_RAMP = {
  strong: { text: "font-semibold text-foreground", fill: "bg-ink-900" },
  good: { text: "text-foreground", fill: "bg-ink-500" },
  weak: { text: "text-muted-foreground", fill: "bg-ink-300" },
  poor: { text: "text-muted-foreground", fill: "bg-ink-200" },
} as const;

/** The neutral glyph — unknown, unset, or not-yet-started. */
export const NEUTRAL_DOT = "hb hb-0";

/* ── Tasks ────────────────────────────────────────────────────────────────── */

/**
 * The four task states, in board order, on the same glyph as company status: backlog is
 * dashed (not started), in progress half blue, done full green. Blocked is the struck
 * ring in amber — the same mark as a bounced email, because both mean "this cannot move
 * as it is".
 */
export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; short: string; dot: string; chip: string; ink: string }
> = {
  BACKLOG: {
    label: "Backlog",
    short: "Backlog",
    dot: "hb hb-dashed",
    chip: "border-border bg-card text-muted-foreground",
    ink: "text-muted-foreground",
  },
  IN_PROGRESS: {
    label: "In progress",
    short: "In progress",
    dot: "hb hb-50 hb-info",
    chip: "border-info-line bg-info-soft text-info-ink",
    ink: "text-foreground",
  },
  BLOCKED: {
    label: "Blocked",
    short: "Blocked",
    dot: "hb hb-void hb-warning",
    chip: "border-warning-line bg-warning-soft text-warning-ink",
    ink: "font-medium text-warning-ink",
  },
  DONE: {
    label: "Done",
    short: "Done",
    dot: "hb hb-100 hb-success",
    chip: "border-success-line bg-success-soft text-success-ink",
    ink: "text-muted-foreground",
  },
};

// Board order lives in `lib/tasks.ts` with the rest of the domain rules, not here —
// this file owns how a status *looks*, not what the set of statuses is.

/**
 * Priority is a dot, not a chip. MEDIUM is the default and renders as nothing at all —
 * only the two ends of the scale are worth a mark.
 */
export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; ink: string; showDot: boolean }
> = {
  HIGH: {
    label: "High",
    dot: "bg-danger",
    ink: "font-medium text-foreground",
    showDot: true,
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-ink-400",
    ink: "text-muted-foreground",
    showDot: false,
  },
  LOW: {
    label: "Low",
    dot: "bg-card ring-1 ring-inset ring-ink-400",
    ink: "text-muted-foreground",
    showDot: true,
  },
};

/** Due-date ink. Overdue is red, today amber; the rest recede. */
export const DUE_TONE = {
  overdue: "font-medium text-danger-ink",
  today: "font-medium text-warning-ink",
  soon: "text-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
} as const;

/* ── Activity ─────────────────────────────────────────────────────────────── */

/**
 * The verb badge on an activity row, one treatment per verb group. The icon inside
 * names the verb; the treatment only has to separate the kinds of change when the eye
 * runs down the column. Outreach is blue (a touch went out); the one verb that destroys
 * something is red.
 */
export const ACTIVITY_TONE = {
  deal: "bg-foreground text-background",
  outreach: "bg-info-soft text-info-ink ring-1 ring-inset ring-info-line",
  data: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  people: "bg-card text-foreground ring-1 ring-inset ring-border",
  danger: "bg-danger-soft text-danger-ink ring-1 ring-inset ring-danger-line",
} as const;

/** How a member got onto a project. Only `assigned` is a grant a partner made. */
export const MEMBER_SOURCE_META = {
  assigned: { label: "Assigned", hint: "Given access to this project" },
  mandate: { label: "Engagement", hint: "Works an engagement in this project" },
  creator: { label: "Opened it", hint: "Opened this project" },
} as const;
