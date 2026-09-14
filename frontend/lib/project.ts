/**
 * The project workspace's derivations — React-free, so they can be unit-tested and so
 * every surface of the project (overview, workspace, analytics, header) reads the same
 * numbers from the same functions.
 *
 * Nothing here recomputes cadence. `is_overdue`, `days_remaining` and `schedule_status`
 * arrive already computed server-side against IST today (CLAUDE.md rule 2); this file
 * only *counts* and *groups* what the server decided. If you find yourself comparing a
 * date to `new Date()` in here, the number belongs on the server instead.
 */

import type {
  Company,
  MandateEngagementStats,
  MandateType,
  ProjectDetail,
  Task,
} from "@/types";

/* ── Attention ─────────────────────────────────────────────────────────────── */

/**
 * The four things that can be wrong with a company, in the order an analyst would
 * act on them. `cold` is deliberately not attention — the cadence exhausted itself,
 * which is an outcome, not a backlog item.
 */
export type AttentionKind = "late" | "awaiting" | "no-contact" | "none";

export function attentionOf(c: Company): AttentionKind {
  if (c.is_cold) return "none";
  if (c.is_overdue) return "late";
  if (c.schedule_status === "AWAITING_INITIAL") return "awaiting";
  // A company nobody can email is stuck whatever its schedule says — but only worth
  // flagging while the cadence is still meant to be running.
  if (!c.primary_contact && c.schedule_status !== "STOPPED") return "no-contact";
  return "none";
}

export function needsAttention(c: Company): boolean {
  return attentionOf(c) !== "none";
}

/** Attention weight — how a group sorts when several of them have problems. */
const ATTENTION_RANK: Record<AttentionKind, number> = {
  late: 3,
  awaiting: 2,
  "no-contact": 1,
  none: 0,
};

/* ── Roll-ups ──────────────────────────────────────────────────────────────── */

export interface Vitals {
  total: number;
  /** Emailed at least once — the honest denominator for a reply rate. */
  contacted: number;
  replied: number;
  late: number;
  awaiting: number;
  cold: number;
  noContact: number;
  /** replied / contacted, 0 when nobody has been contacted. */
  replyRate: number;
}

export function vitalsOf(companies: Company[]): Vitals {
  let contacted = 0;
  let replied = 0;
  let late = 0;
  let awaiting = 0;
  let cold = 0;
  let noContact = 0;

  for (const c of companies) {
    if (c.status !== "NOT_CONTACTED") contacted += 1;
    if (c.status === "RESPONDED" || c.status === "INTERESTED" || c.status === "DECLINED") {
      replied += 1;
    }
    if (c.is_cold) cold += 1;
    else if (c.is_overdue) late += 1;
    else if (c.schedule_status === "AWAITING_INITIAL") awaiting += 1;
    if (!c.primary_contact) noContact += 1;
  }

  return {
    total: companies.length,
    contacted,
    replied,
    late,
    awaiting,
    cold,
    noContact,
    replyRate: contacted > 0 ? replied / contacted : 0,
  };
}

/* ── The hierarchy ─────────────────────────────────────────────────────────── */

/**
 * Project → Engagement → Band (sourcing layer) → Category → Company.
 *
 * Every level carries its own vitals so a collapsed group still answers "how much, and
 * how much of it is late" — the whole point of collapsing it. `path` is a stable key
 * for the expand/collapse set, so reordering or refiltering never loses which groups
 * the user had open.
 */
export type GroupLevel = "engagement" | "band" | "category" | "status" | "flat";

export interface WorkspaceNode {
  /** Stable across renders and filter changes. */
  path: string;
  level: GroupLevel;
  label: string;
  /** The record this node stands for, when it stands for one. */
  engagement?: MandateEngagementStats;
  mandateId?: number;
  layerId?: number | null;
  categoryId?: number | null;
  children: WorkspaceNode[];
  /** Only leaves carry companies; a branch's companies are its descendants'. */
  companies: Company[];
  vitals: Vitals;
  attention: AttentionKind;
}

/** How the workspace groups below the engagement. */
/**
 * How the workspace stacks companies.
 *
 * `none` still nests under the engagement — a company without a book is not a thing
 * this product has. `flat` drops even that, and exists for the attention-shaped views:
 * a queue of "what do I do next" that re-sorts by engagement is not a queue, it is a
 * filing cabinet. Structural views group; working views do not.
 */
export type GroupBy = "band-category" | "category" | "band" | "status" | "none" | "flat";

export interface BuildOptions {
  companies: Company[];
  engagements: MandateEngagementStats[];
  groupBy: GroupBy;
  /**
   * Sourcing-layer ids in the firm's own order, per engagement — bands are defined on
   * the engagement, so there is no single project-wide band order to hold.
   */
  layerOrderByMandate?: Record<number, number[]>;
  /** Category ids in the firm's own order. */
  categoryOrder?: number[];
  /** Labels for statuses, injected so this file stays free of the design layer. */
  statusLabels?: Record<string, string>;
  /**
   * Orders the companies inside every leaf. Injected rather than a sort key so the
   * sort vocabulary lives with the views (`lib/project-views.ts`) and this file keeps
   * knowing only how to count and nest.
   */
  sortLeaf?: (companies: Company[]) => Company[];
}

const UNSORTED_BAND = "Unsorted";
const UNCATEGORIZED = "Uncategorized";

function worstAttention(companies: Company[]): AttentionKind {
  let worst: AttentionKind = "none";
  for (const c of companies) {
    const a = attentionOf(c);
    if (ATTENTION_RANK[a] > ATTENTION_RANK[worst]) worst = a;
    if (worst === "late") break;
  }
  return worst;
}

function leaf(
  path: string,
  level: GroupLevel,
  label: string,
  companies: Company[],
  extra: Partial<WorkspaceNode> = {},
): WorkspaceNode {
  return {
    path,
    level,
    label,
    children: [],
    companies,
    vitals: vitalsOf(companies),
    attention: worstAttention(companies),
    ...extra,
  };
}

function branch(
  path: string,
  level: GroupLevel,
  label: string,
  children: WorkspaceNode[],
  extra: Partial<WorkspaceNode> = {},
): WorkspaceNode {
  const companies = children.flatMap((c) => c.companies);
  return {
    path,
    level,
    label,
    children,
    companies,
    vitals: vitalsOf(companies),
    attention: worstAttention(companies),
    ...extra,
  };
}

/**
 * Ordered by the firm's own vocabulary, then by label, with the unset bucket last.
 *
 * Three tiers on purpose. The firm's order is the only one that carries meaning (a band
 * called "Tier 1" must sit above "Tier 3" however the alphabet feels about it), but a
 * value the vocabulary has never heard of still has to land somewhere stable — and the
 * one thing worse than an odd order is an order that changes between renders because it
 * fell out of a Map. Alphabetical is the tiebreak; unset is always last.
 */
function sortNodes(nodes: WorkspaceNode[], order: number[], unsetKey: keyof WorkspaceNode): WorkspaceNode[] {
  const rank = (n: WorkspaceNode): number => {
    const id = n[unsetKey] as number | null | undefined;
    if (id == null) return Number.MAX_SAFE_INTEGER;
    const i = order.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER - 1 : i;
  };
  return [...nodes].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

function groupCategories(
  parentPath: string,
  companies: Company[],
  categoryOrder: number[],
): WorkspaceNode[] {
  const byCat = new Map<number | null, Company[]>();
  for (const c of companies) {
    const key = c.category_id ?? null;
    const list = byCat.get(key);
    if (list) list.push(c);
    else byCat.set(key, [c]);
  }
  const nodes = [...byCat.entries()].map(([key, list]) =>
    leaf(
      `${parentPath}/cat-${key ?? "none"}`,
      "category",
      list[0]?.category_name ?? UNCATEGORIZED,
      list,
      { categoryId: key },
    ),
  );
  return sortNodes(nodes, categoryOrder, "categoryId");
}

function groupBands(
  parentPath: string,
  companies: Company[],
  layerOrder: number[],
  categoryOrder: number[],
  nestCategories: boolean,
): WorkspaceNode[] {
  const byLayer = new Map<number | null, Company[]>();
  for (const c of companies) {
    const key = c.sourcing_layer_id ?? null;
    const list = byLayer.get(key);
    if (list) list.push(c);
    else byLayer.set(key, [c]);
  }
  const nodes = [...byLayer.entries()].map(([key, list]) => {
    const path = `${parentPath}/band-${key ?? "none"}`;
    const label = key === null ? UNSORTED_BAND : (list[0]?.sourcing_layer_name ?? "Band");
    return nestCategories
      ? branch(path, "band", label, groupCategories(path, list, categoryOrder), {
          layerId: key,
        })
      : leaf(path, "band", label, list, { layerId: key });
  });
  return sortNodes(nodes, layerOrder, "layerId");
}

function groupStatuses(
  parentPath: string,
  companies: Company[],
  statusLabels: Record<string, string>,
): WorkspaceNode[] {
  const byStatus = new Map<string, Company[]>();
  for (const c of companies) {
    const list = byStatus.get(c.status);
    if (list) list.push(c);
    else byStatus.set(c.status, [c]);
  }
  return [...byStatus.entries()].map(([status, list]) =>
    leaf(`${parentPath}/status-${status}`, "status", statusLabels[status] ?? status, list),
  );
}

/**
 * The workspace tree. Engagements are always the top level — a project's book is its
 * engagements, and a company that is not under one cannot exist.
 *
 * An engagement with no companies still gets a node: an empty book you can see is a
 * book you can fill, and one the tree silently drops is a book that looks deleted.
 */
export function buildWorkspace({
  companies,
  engagements,
  groupBy,
  layerOrderByMandate = {},
  categoryOrder = [],
  statusLabels = {},
  sortLeaf,
}: BuildOptions): WorkspaceNode[] {
  const byMandate = new Map<number, Company[]>();
  for (const c of companies) {
    const list = byMandate.get(c.mandate_id);
    if (list) list.push(c);
    else byMandate.set(c.mandate_id, [c]);
  }

  const tree = engagements.map((eng) => {
    const own = byMandate.get(eng.id) ?? [];
    const path = `eng-${eng.id}`;
    const extra = { engagement: eng, mandateId: eng.id };
    const layerOrder = layerOrderByMandate[eng.id] ?? [];

    if (own.length === 0) return leaf(path, "engagement", eng.name, [], extra);

    switch (groupBy) {
      // `flat` never reaches here in practice (the row builder short-circuits it), but
      // an engagement-only tree is the right degenerate answer if it ever does.
      case "flat":
      case "none":
        return leaf(path, "engagement", eng.name, own, extra);
      case "category":
        return branch(path, "engagement", eng.name, groupCategories(path, own, categoryOrder), extra);
      case "band":
        return branch(
          path,
          "engagement",
          eng.name,
          groupBands(path, own, layerOrder, categoryOrder, false),
          extra,
        );
      case "status":
        return branch(path, "engagement", eng.name, groupStatuses(path, own, statusLabels), extra);
      case "band-category":
      default:
        return branch(
          path,
          "engagement",
          eng.name,
          groupBands(path, own, layerOrder, categoryOrder, true),
          extra,
        );
    }
  });

  // Ordering is applied to leaves after the tree is built rather than at every place a
  // leaf is constructed. A branch's `companies` is the concatenation of its children's,
  // so sorting leaves in place leaves every roll-up above them correct and untouched.
  if (sortLeaf) sortLeafCompanies(tree, sortLeaf);

  return tree;
}

/** Every node in the tree, depth-first — for "expand all" and for counting. */
function sortLeafCompanies(
  nodes: WorkspaceNode[],
  sortLeaf: (companies: Company[]) => Company[],
): void {
  for (const n of nodes) {
    if (n.children.length === 0) n.companies = sortLeaf(n.companies);
    else sortLeafCompanies(n.children, sortLeaf);
  }
}

export function flattenNodes(nodes: WorkspaceNode[]): WorkspaceNode[] {
  const out: WorkspaceNode[] = [];
  const walk = (list: WorkspaceNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/* ── Filtering ─────────────────────────────────────────────────────────────── */

export interface WorkspaceFilter {
  q?: string;
  attentionOnly?: boolean;
  /** Restrict to one engagement; 0 / undefined means the whole project. */
  mandateId?: number;
  status?: string;
}

/** One haystack per company, so search covers the record the way a person reads it. */
function haystack(c: Company): string {
  return [
    c.company_name,
    c.hq,
    c.category_name,
    c.sourcing_layer_name,
    c.primary_contact?.contact_person,
    c.primary_contact?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterCompanies(companies: Company[], f: WorkspaceFilter): Company[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return companies.filter((c) => {
    if (f.mandateId && c.mandate_id !== f.mandateId) return false;
    if (f.attentionOnly && !needsAttention(c)) return false;
    if (f.status && c.status !== f.status) return false;
    if (q && !haystack(c).includes(q)) return false;
    return true;
  });
}

/* ── Overview: what needs my attention ─────────────────────────────────────── */

export interface AttentionItem {
  company: Company;
  kind: Exclude<AttentionKind, "none">;
  /** Sorts within a kind: days late, descending. */
  weight: number;
}

/**
 * The overview's queue. Late first, longest-late at the top, then intros that have
 * never gone out, then companies with nobody to email.
 *
 * Deliberately a *list of records*, not a count: a number tells you something is wrong,
 * a row tells you what to click.
 */
export function attentionQueue(companies: Company[], limit = 8): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const c of companies) {
    const kind = attentionOf(c);
    if (kind === "none") continue;
    items.push({
      company: c,
      kind,
      weight: kind === "late" ? Math.abs(c.days_remaining ?? 0) : 0,
    });
  }
  items.sort((a, b) => {
    const rank = ATTENTION_RANK[b.kind] - ATTENTION_RANK[a.kind];
    if (rank !== 0) return rank;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.company.company_name.localeCompare(b.company.company_name);
  });
  return items.slice(0, limit);
}

/* ── Progress ──────────────────────────────────────────────────────────────── */

export interface ProgressStep {
  key: "sourced" | "contacted" | "replied" | "interested";
  label: string;
  value: number;
  /** Share of the step before it — the honest conversion, not share of total. */
  ofPrevious: number;
}

/**
 * The outreach progression, each step measured against the one before it.
 *
 * "Sourced → contacted → replied → interested" is the same spine the firm-wide
 * analytics page draws; keeping the definitions identical is why `vitalsOf` computes
 * `contacted` from status rather than from a separate field.
 */
export function progressSteps(companies: Company[]): ProgressStep[] {
  const v = vitalsOf(companies);
  const interested = companies.filter((c) => c.status === "INTERESTED").length;
  const steps: Omit<ProgressStep, "ofPrevious">[] = [
    { key: "sourced", label: "Sourced", value: v.total },
    { key: "contacted", label: "Contacted", value: v.contacted },
    { key: "replied", label: "Replied", value: v.replied },
    { key: "interested", label: "Interested", value: interested },
  ];
  return steps.map((s, i) => {
    const prev = i === 0 ? s.value : steps[i - 1].value;
    return { ...s, ofPrevious: prev > 0 ? s.value / prev : 0 };
  });
}

/* ── Engagements ───────────────────────────────────────────────────────────── */

/** All three sides in one list, in the order the product always names them. */
export const SIDE_ORDER: MandateType[] = ["SELL_SIDE", "BUY_SIDE", "CAPITAL_RAISE"];

export function allEngagements(project: ProjectDetail | undefined): MandateEngagementStats[] {
  if (!project) return [];
  return SIDE_ORDER.flatMap((side) => project.engagements[side] ?? []);
}

/* ── Work ──────────────────────────────────────────────────────────────────── */

export interface WorkBucket {
  key: "overdue" | "today" | "week" | "later" | "none";
  label: string;
  tasks: Task[];
}

/**
 * Tasks bucketed by *when*, not by status — the question a project lead asks is "what
 * is late", and status already has a board. `todayIso` is passed in rather than read
 * from the clock so this stays deterministic and testable.
 */
export function bucketTasksByDue(tasks: Task[], todayIso: string): WorkBucket[] {
  const buckets: Record<WorkBucket["key"], Task[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    none: [],
  };

  const today = new Date(`${todayIso}T00:00:00`);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  for (const t of tasks) {
    if (t.status === "DONE") continue;
    if (!t.due_date) {
      buckets.none.push(t);
      continue;
    }
    // `is_overdue` is the server's word (IST), and it wins over any local comparison.
    if (t.is_overdue) {
      buckets.overdue.push(t);
      continue;
    }
    if (t.due_date === todayIso) buckets.today.push(t);
    else if (new Date(`${t.due_date}T00:00:00`) <= weekEnd) buckets.week.push(t);
    else buckets.later.push(t);
  }

  const ordered: WorkBucket[] = [
    { key: "overdue", label: "Overdue", tasks: buckets.overdue },
    { key: "today", label: "Today", tasks: buckets.today },
    { key: "week", label: "This week", tasks: buckets.week },
    { key: "later", label: "Later", tasks: buckets.later },
    { key: "none", label: "No due date", tasks: buckets.none },
  ];
  return ordered.filter((b) => b.tasks.length > 0);
}
