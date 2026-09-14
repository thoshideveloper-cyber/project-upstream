/**
 * Views, filters and priority — the workspace's decision layer.
 *
 * The old workspace had exactly one lens: a hierarchy, plus four dropdowns that narrowed
 * it. That answers "how is this project organised" and nothing else, so every other
 * question an analyst has ("what is late", "what did I touch", "what has gone quiet")
 * had to be assembled by hand out of the same four controls, every morning, from scratch.
 *
 * This file separates the three things that were tangled together in those dropdowns:
 *
 *   1. a FILTER decides which companies are in play,
 *   2. a GROUPING decides how they are stacked,
 *   3. a VIEW is a named pairing of the two, with a sort, that you can return to.
 *
 * Keeping them separate is what makes a view system possible: "Needs attention" and
 * "By engagement" are not different pages and not different datasets, they are two
 * saved answers to (filter, group, sort) over one array of companies.
 *
 * React-free on purpose — same reason as `lib/project.ts`. Everything here is a pure
 * function over the `Company` records the server already computed, so it is unit-tested
 * directly and no surface can disagree with another about what "late" means.
 *
 * NOTHING HERE RECOMPUTES CADENCE. `is_overdue`, `days_remaining`, `schedule_status` and
 * `is_cold` arrive decided by the server against IST today (CLAUDE.md rule 2). This file
 * reads them. If you find a `new Date()` comparison below, it is a bug.
 */

import { attentionOf, type AttentionKind, type GroupBy } from "@/lib/project";
import type { Company } from "@/types";

/* ── Filter model ──────────────────────────────────────────────────────────── */

/**
 * The fields a condition can address.
 *
 * Every one of these maps to something already on a `Company`. There is deliberately no
 * field here that the data model cannot answer — a filter that returns "unknown" is
 * worse than a filter that doesn't exist, because the user cannot tell the difference
 * between "none match" and "we don't track that".
 */
export type FilterField =
  | "engagement"
  | "band"
  | "category"
  | "status"
  | "attention"
  | "contact"
  | "cadence"
  | "dueWithin"
  | "overdueBy"
  | "hq";

export type FilterOp = "any_of" | "none_of" | "lte" | "gte";

export interface FilterCondition {
  /** Stable across edits so React keys and URL round-trips don't shuffle rows. */
  id: string;
  field: FilterField;
  op: FilterOp;
  /** Always an array, even for scalar ops — one shape to encode and validate. */
  values: (string | number)[];
}

/**
 * One level of nesting, and only one, on purpose.
 *
 * Attio and Linear both allow nested condition groups; both also bury them behind an
 * "advanced" affordance most users never open. A flat list with a single AND/OR join
 * covers every filter an analyst actually described wanting here, and it can be read
 * aloud ("late AND in Book raise") without a diagram. If a genuine need for nesting
 * shows up, it is additive — `conditions` becomes `(FilterCondition | FilterGroup)[]`
 * and `matchesFilter` recurses.
 */
export interface FilterGroup {
  join: "and" | "or";
  conditions: FilterCondition[];
}

export const EMPTY_FILTER: FilterGroup = { join: "and", conditions: [] };

export function isEmptyFilter(f: FilterGroup | undefined): boolean {
  return !f || f.conditions.length === 0;
}

/** Field metadata the filter UI reads, so the UI never hardcodes a field list. */
export interface FieldDef {
  field: FilterField;
  label: string;
  /** How the value editor should behave. */
  kind: "enum" | "number";
  /** Ops offered for this field, first one being the default. */
  ops: FilterOp[];
  /** Unit suffix for number fields ("days"). */
  unit?: string;
}

export const FILTER_FIELDS: FieldDef[] = [
  { field: "engagement", label: "Engagement", kind: "enum", ops: ["any_of", "none_of"] },
  { field: "band", label: "Band", kind: "enum", ops: ["any_of", "none_of"] },
  { field: "category", label: "Category", kind: "enum", ops: ["any_of", "none_of"] },
  { field: "status", label: "Status", kind: "enum", ops: ["any_of", "none_of"] },
  { field: "attention", label: "Needs attention", kind: "enum", ops: ["any_of", "none_of"] },
  { field: "cadence", label: "Cadence", kind: "enum", ops: ["any_of", "none_of"] },
  { field: "contact", label: "Contact", kind: "enum", ops: ["any_of"] },
  { field: "overdueBy", label: "Overdue by", kind: "number", ops: ["gte", "lte"], unit: "days" },
  { field: "dueWithin", label: "Due within", kind: "number", ops: ["lte", "gte"], unit: "days" },
  { field: "hq", label: "HQ", kind: "enum", ops: ["any_of", "none_of"] },
];

export const FIELD_BY_KEY: Record<FilterField, FieldDef> = Object.fromEntries(
  FILTER_FIELDS.map((f) => [f.field, f]),
) as Record<FilterField, FieldDef>;

export const OP_LABEL: Record<FilterOp, string> = {
  any_of: "is any of",
  none_of: "is none of",
  gte: "at least",
  lte: "at most",
};

/**
 * `cadence` is the schedule's own state, which is NOT the same question as `attention`.
 * A company can be running perfectly and still be the thing you work on next; a company
 * can be stopped and need nothing. Conflating them is how "cold" ended up counted as a
 * backlog item on the old page.
 */
export type CadenceKind = "running" | "awaiting" | "cold" | "stopped";

export function cadenceOf(c: Company): CadenceKind {
  if (c.is_cold) return "cold";
  if (c.schedule_status === "AWAITING_INITIAL") return "awaiting";
  if (c.schedule_status === "ACTIVE") return "running";
  return "stopped";
}

export const CADENCE_LABEL: Record<CadenceKind, string> = {
  running: "Running",
  awaiting: "Intro pending",
  cold: "Gone cold",
  stopped: "Stopped",
};

export const ATTENTION_LABEL: Record<Exclude<AttentionKind, "none">, string> = {
  late: "Overdue follow-up",
  awaiting: "Intro pending",
  "no-contact": "No contact",
};

/** The raw value a condition compares against, per field. */
function fieldValue(c: Company, field: FilterField): (string | number | null)[] {
  switch (field) {
    case "engagement":
      return [c.mandate_id];
    case "band":
      return [c.sourcing_layer_id ?? "none"];
    case "category":
      return [c.category_id ?? "none"];
    case "status":
      return [c.status];
    case "attention": {
      const a = attentionOf(c);
      return [a === "none" ? "none" : a];
    }
    case "cadence":
      return [cadenceOf(c)];
    case "contact":
      return [c.primary_contact ? "has" : "missing"];
    case "hq":
      return [c.hq ?? "none"];
    case "overdueBy":
      // Only overdue rows have an overdue age; everything else is excluded from the
      // comparison rather than treated as 0, which would sweep the whole book in.
      return c.is_overdue ? [Math.abs(c.days_remaining ?? 0)] : [null];
    case "dueWithin":
      // Likewise: a stopped or cold schedule has no "due in N days" at all.
      return c.schedule_status === "ACTIVE" && !c.is_cold && c.days_remaining != null
        ? [c.days_remaining]
        : [null];
    default:
      return [null];
  }
}

function matchesCondition(c: Company, cond: FilterCondition): boolean {
  if (cond.values.length === 0) return true; // an unfinished condition filters nothing
  const actual = fieldValue(c, cond.field);

  switch (cond.op) {
    case "any_of":
      return actual.some((v) => v != null && cond.values.some((w) => String(w) === String(v)));
    case "none_of":
      return !actual.some((v) => v != null && cond.values.some((w) => String(w) === String(v)));
    case "gte": {
      const n = actual[0];
      return typeof n === "number" && n >= Number(cond.values[0]);
    }
    case "lte": {
      const n = actual[0];
      return typeof n === "number" && n <= Number(cond.values[0]);
    }
    default:
      return true;
  }
}

export function matchesFilter(c: Company, f: FilterGroup | undefined): boolean {
  if (isEmptyFilter(f)) return true;
  const conds = f!.conditions;
  return f!.join === "and"
    ? conds.every((cond) => matchesCondition(c, cond))
    : conds.some((cond) => matchesCondition(c, cond));
}

/** Human-readable summary of a filter, for the toolbar chip and saved-view list. */
export function describeFilter(
  f: FilterGroup | undefined,
  labels: (field: FilterField, value: string | number) => string,
): string {
  if (isEmptyFilter(f)) return "";
  return f!.conditions
    .map((c) => {
      const def = FIELD_BY_KEY[c.field];
      const vals = c.values.map((v) => labels(c.field, v)).join(", ");
      return `${def?.label ?? c.field} ${OP_LABEL[c.op]} ${vals}${def?.unit ? ` ${def.unit}` : ""}`;
    })
    .join(f!.join === "and" ? " · " : " or ");
}

/* ── Sorting ───────────────────────────────────────────────────────────────── */

export type SortKey =
  | "priority"
  | "name"
  | "overdue"
  | "next"
  | "status"
  | "recent";

export const SORT_LABEL: Record<SortKey, string> = {
  priority: "Priority",
  name: "Company name",
  overdue: "Most overdue",
  next: "Next touch",
  status: "Status",
  recent: "Recently added",
};

/**
 * Sorting a company list.
 *
 * `priority` is the default for attention-shaped views and deliberately NOT the default
 * for structural ones — sorting "By category" by priority would shuffle the categories'
 * contents on every cadence tick and destroy the stable reading order that makes a
 * structural view useful.
 */
export function sortCompanies(companies: Company[], key: SortKey): Company[] {
  const byName = (a: Company, b: Company) => a.company_name.localeCompare(b.company_name);
  const out = [...companies];

  switch (key) {
    case "priority":
      return out.sort(
        (a, b) => priorityOf(b).score - priorityOf(a).score || byName(a, b),
      );
    case "overdue":
      return out.sort((a, b) => {
        const av = a.is_overdue ? Math.abs(a.days_remaining ?? 0) : -1;
        const bv = b.is_overdue ? Math.abs(b.days_remaining ?? 0) : -1;
        return bv - av || byName(a, b);
      });
    case "next":
      return out.sort((a, b) => {
        // No next touch sorts last: a stopped schedule is not "due first".
        const av = a.next_due_date ?? "9999-12-31";
        const bv = b.next_due_date ?? "9999-12-31";
        return av.localeCompare(bv) || byName(a, b);
      });
    case "status":
      return out.sort((a, b) => a.status.localeCompare(b.status) || byName(a, b));
    case "recent":
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at) || byName(a, b));
    case "name":
    default:
      return out.sort(byName);
  }
}

/* ── Priority ──────────────────────────────────────────────────────────────── */

/**
 * Why this company, and why now — stated, not scored in secret.
 *
 * The brief for this was explicit and it is the right instinct: no black-box number. So
 * a priority is a list of REASONS first and a score second, the score exists only to
 * order the list, and the UI shows the reasons rather than the number. Every reason is a
 * re-reading of a field the server already computed, which means a user can check it.
 *
 * The weights encode one editorial claim, which is worth stating plainly because it is a
 * judgement and not a fact: a reply you have not answered outranks a follow-up you have
 * not sent. A reply is a live counterparty waiting on you and it decays in hours; an
 * overdue follow-up decays in days. Everything else follows from age.
 */
export interface PriorityReason {
  /** Shown verbatim in the UI. Keep it a fact, not an exhortation. */
  label: string;
  weight: number;
  tone: "danger" | "awaiting" | "positive" | "neutral";
}

export interface Priority {
  score: number;
  band: "high" | "medium" | "low" | "none";
  reasons: PriorityReason[];
}

const HIGH = 60;
const MEDIUM = 25;

export function priorityOf(c: Company): Priority {
  const reasons: PriorityReason[] = [];

  // A reply nobody has acted on. RESPONDED means the counterparty answered and the
  // cadence stopped (rule 4) — so this row will never resurface on its own.
  if (c.status === "RESPONDED") {
    reasons.push({ label: "Replied — not yet actioned", weight: 70, tone: "positive" });
  }
  if (c.status === "INTERESTED") {
    reasons.push({ label: "Interested — needs a next step", weight: 55, tone: "positive" });
  }

  if (c.is_overdue) {
    const days = Math.abs(c.days_remaining ?? 0);
    // Ramps steeply for the first fortnight, then flattens: the difference between 3
    // and 12 days late is real, the difference between 80 and 90 is not.
    const weight = Math.min(60, 12 + days * 3);
    reasons.push({
      label: days === 1 ? "1 day overdue" : `${days} days overdue`,
      weight,
      tone: "danger",
    });
  }

  if (c.schedule_status === "AWAITING_INITIAL" && !c.is_cold) {
    // Age of the record stands in for how long the intro has been sitting. There is no
    // "added to book" clock other than created_at, and saying so is better than a
    // fabricated one.
    reasons.push({ label: "Intro never sent", weight: 30, tone: "awaiting" });
  }

  if (!c.primary_contact && c.schedule_status !== "STOPPED" && !c.is_cold) {
    reasons.push({ label: "No contact to email", weight: 22, tone: "neutral" });
  }

  if (
    !c.is_cold &&
    c.schedule_status === "ACTIVE" &&
    c.days_remaining != null &&
    c.days_remaining >= 0 &&
    c.days_remaining <= 3
  ) {
    reasons.push({
      label: c.days_remaining === 0 ? "Due today" : `Due in ${c.days_remaining} days`,
      weight: 18,
      tone: "neutral",
    });
  }

  // Cold is not urgency — the cadence ran its course. It is listed so the panel can say
  // why a row that looks idle is idle, at a weight that never lifts it up a queue.
  if (c.is_cold) {
    reasons.push({ label: "Follow-up cap reached", weight: 0, tone: "neutral" });
  }

  reasons.sort((a, b) => b.weight - a.weight);
  const score = reasons.reduce((n, r) => n + r.weight, 0);

  return {
    score,
    band: score >= HIGH ? "high" : score >= MEDIUM ? "medium" : score > 0 ? "low" : "none",
    reasons,
  };
}

export const PRIORITY_LABEL: Record<Priority["band"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "—",
};

/* ── Views ─────────────────────────────────────────────────────────────────── */

/**
 * A view is a named (filter, group, sort) triple. That is the whole idea.
 *
 * The built-ins below are the questions this product's users ask often enough that
 * rebuilding the filter each time is a tax. Each one is expressible in the same filter
 * model a user gets, which is deliberate: there is no privileged built-in that a saved
 * view cannot reproduce, so "Needs attention" can be duplicated and tweaked rather than
 * only accepted or rejected.
 */
export interface ViewDef {
  key: string;
  label: string;
  /** One line, shown under the name in the view picker. Says what the view answers. */
  hint: string;
  filter: FilterGroup;
  group: GroupBy;
  sort: SortKey;
}

const cond = (
  id: string,
  field: FilterField,
  op: FilterOp,
  values: (string | number)[],
): FilterCondition => ({ id, field, op, values });

export const BUILTIN_VIEWS: ViewDef[] = [
  {
    key: "all",
    label: "All companies",
    hint: "The whole book, by engagement",
    filter: EMPTY_FILTER,
    group: "band-category",
    sort: "name",
  },
  {
    key: "attention",
    label: "Needs attention",
    hint: "Overdue, intro pending, or blocked — most urgent first",
    filter: { join: "and", conditions: [cond("a", "attention", "any_of", ["late", "awaiting", "no-contact"])] },
    group: "flat",
    sort: "priority",
  },
  {
    key: "follow-ups",
    label: "Overdue follow-ups",
    hint: "The clock has run out and nothing has gone out",
    filter: { join: "and", conditions: [cond("a", "attention", "any_of", ["late"])] },
    group: "flat",
    sort: "overdue",
  },
  {
    key: "intro-pending",
    label: "Intro pending",
    hint: "In the book, never emailed — the clock hasn't started",
    filter: { join: "and", conditions: [cond("a", "cadence", "any_of", ["awaiting"])] },
    group: "flat",
    sort: "recent",
  },
  {
    key: "replied",
    label: "Replied",
    hint: "They answered — these need a human next step",
    filter: {
      join: "and",
      conditions: [cond("a", "status", "any_of", ["RESPONDED", "INTERESTED"])],
    },
    group: "flat",
    sort: "priority",
  },
  {
    key: "due-soon",
    label: "Due this week",
    hint: "Running cadences landing in the next seven days",
    filter: {
      join: "and",
      conditions: [
        cond("a", "cadence", "any_of", ["running"]),
        cond("b", "dueWithin", "lte", [7]),
      ],
    },
    group: "flat",
    sort: "next",
  },
  {
    key: "cold",
    label: "Gone cold",
    hint: "Follow-up cap reached with no answer",
    filter: { join: "and", conditions: [cond("a", "cadence", "any_of", ["cold"])] },
    group: "flat",
    sort: "name",
  },
  {
    key: "blocked",
    label: "No contact",
    hint: "Nobody to email — the cadence cannot run",
    filter: { join: "and", conditions: [cond("a", "contact", "any_of", ["missing"])] },
    group: "flat",
    sort: "name",
  },
  {
    key: "by-engagement",
    label: "By engagement",
    hint: "Which book is carrying the work",
    filter: EMPTY_FILTER,
    group: "none",
    sort: "name",
  },
  {
    key: "by-band",
    label: "By band",
    hint: "The analyst's own segmentation",
    filter: EMPTY_FILTER,
    group: "band",
    sort: "name",
  },
  {
    key: "by-category",
    label: "By category",
    hint: "The firm's counterparty vocabulary",
    filter: EMPTY_FILTER,
    group: "category",
    sort: "name",
  },
  {
    key: "by-status",
    label: "By status",
    hint: "Where the book sits in the funnel",
    filter: EMPTY_FILTER,
    group: "status",
    sort: "name",
  },
];

export const VIEW_BY_KEY: Record<string, ViewDef> = Object.fromEntries(
  BUILTIN_VIEWS.map((v) => [v.key, v]),
);

/** Views the toolbar offers as one-click lenses, in the order an analyst works. */
export const QUICK_VIEW_KEYS = ["all", "attention", "replied", "due-soon"] as const;

/* ── Saved views ───────────────────────────────────────────────────────────── */

export interface SavedView extends ViewDef {
  /** Distinguishes a user's own view from a built-in of the same shape. */
  saved: true;
  createdAt: string;
}

export function isSavedView(v: ViewDef | SavedView): v is SavedView {
  return (v as SavedView).saved === true;
}

/* ── URL encoding ──────────────────────────────────────────────────────────── */

/**
 * A filter, in a query string.
 *
 * JSON-in-a-param would work and would be unreadable; a URL an analyst can glance at
 * ("...&f=attention:any_of:late") is one they can hand-edit and one that survives being
 * pasted into a ticket. The grammar is three levels of separator and nothing else:
 *
 *     [or;]field:op:value|value[,field:op:value]
 *
 * The leading `or;` is present only for the non-default join, so an AND filter — which
 * is almost all of them — costs no extra characters. Decoding is total: anything that
 * doesn't parse is dropped rather than throwing, because a malformed URL should show you
 * the unfiltered book, not an error page.
 */
const COND_SEP = ",";
const PART_SEP = ":";
const VALUE_SEP = "|";

export function encodeFilter(f: FilterGroup | undefined): string {
  if (isEmptyFilter(f)) return "";
  const body = f!.conditions
    .filter((c) => c.values.length > 0)
    .map((c) => `${c.field}${PART_SEP}${c.op}${PART_SEP}${c.values.join(VALUE_SEP)}`)
    .join(COND_SEP);
  if (!body) return "";
  return f!.join === "or" ? `or;${body}` : body;
}

export function decodeFilter(raw: string | null): FilterGroup {
  if (!raw) return EMPTY_FILTER;
  let body = raw;
  let join: FilterGroup["join"] = "and";
  if (body.startsWith("or;")) {
    join = "or";
    body = body.slice(3);
  } else if (body.startsWith("and;")) {
    body = body.slice(4);
  }

  const conditions: FilterCondition[] = [];
  for (const [i, chunk] of body.split(COND_SEP).entries()) {
    const [field, op, values] = chunk.split(PART_SEP);
    if (!field || !op || !values) continue;
    if (!FIELD_BY_KEY[field as FilterField]) continue;
    if (!["any_of", "none_of", "lte", "gte"].includes(op)) continue;
    conditions.push({
      id: `u${i}`,
      field: field as FilterField,
      op: op as FilterOp,
      values: values.split(VALUE_SEP).filter(Boolean),
    });
  }
  return conditions.length ? { join, conditions } : EMPTY_FILTER;
}

export const filterParam = {
  fallback: EMPTY_FILTER as FilterGroup,
  decode: (raw: string | null) => decodeFilter(raw),
  encode: (v: FilterGroup) => encodeFilter(v) || null,
};

/**
 * A link into the workspace that lands on a specific set of records.
 *
 * Analytics uses this for every figure it prints. The point of routing every
 * drill-through through one function is that a number on the analytics page and the list
 * behind it are then guaranteed to be the same query — a hand-built `?attention=late`
 * somewhere else is how the two drift apart.
 */
export function workspaceHref(
  projectId: number,
  opts: { view?: string; filter?: FilterGroup; group?: GroupBy; sort?: SortKey; q?: string } = {},
): string {
  const p = new URLSearchParams();
  if (opts.view && opts.view !== "all") p.set("view", opts.view);
  const f = encodeFilter(opts.filter);
  if (f) p.set("f", f);
  if (opts.group) p.set("group", opts.group);
  if (opts.sort) p.set("sort", opts.sort);
  if (opts.q) p.set("q", opts.q);
  const qs = p.toString();
  return `/projects/${projectId}/workspace${qs ? `?${qs}` : ""}`;
}

/** One condition, for callers building a drill-through by hand. */
export function condition(
  field: FilterField,
  op: FilterOp,
  values: (string | number)[],
): FilterGroup {
  return { join: "and", conditions: [{ id: "d0", field, op, values }] };
}

/* ── Saved views ───────────────────────────────────────────────────────────── */

/**
 * Saved views live in the browser, per project.
 *
 * Deliberately not a server resource yet. A saved view is a personal working habit, not
 * firm data — nobody else needs to see "Priya's overdue pharma" — and putting it on the
 * server means an endpoint, a migration, a sharing model and a permission question
 * before the feature has proved it earns any of them. localStorage is honest about that:
 * it is per-person and per-machine, which is exactly what the feature currently is.
 *
 * Every read is wrapped: a private window, cleared site data, or a browser set to block
 * storage all throw on access, and the workspace must render with no saved views rather
 * than not render at all.
 */
const SAVED_KEY = (projectId: number) => `upstream.workspace.views.${projectId}`;

export function loadSavedViews(projectId: number): SavedView[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is SavedView =>
        !!v && typeof v.key === "string" && typeof v.label === "string" && v.saved === true,
    );
  } catch {
    return [];
  }
}

export function persistSavedViews(projectId: number, views: SavedView[]): void {
  try {
    window.localStorage.setItem(SAVED_KEY(projectId), JSON.stringify(views));
  } catch {
    /* storage unavailable — the views still work for this session */
  }
}

/** Whether the live state still matches the view it claims to be. */
export function matchesView(
  view: ViewDef,
  state: { filter: FilterGroup; group: GroupBy; sort: SortKey },
): boolean {
  return (
    encodeFilter(view.filter) === encodeFilter(state.filter) &&
    view.group === state.group &&
    view.sort === state.sort
  );
}
