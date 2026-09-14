/**
 * The workspace, flattened into one addressable list of rows.
 *
 * The old workspace rendered the tree as nested `<tbody>` fragments and capped each leaf
 * at 40 companies with a "show N more" button. Two problems with that, and only one of
 * them is performance: a cap that lives inside a group means the answer to "how many are
 * late in here" and the answer to "how many can I see" are different numbers, silently.
 * The user is being told 47 and shown 40.
 *
 * Flattening fixes both. A tree plus a collapsed-set is deterministically one array of
 * rows; an array of rows can be windowed; and a windowed list has no cap, so the count in
 * a group header is always the count you can scroll to.
 *
 * This is a pure function of (tree, collapsed) — no React, no measurement, no refs. The
 * virtualizer sits on top of the array it returns and never needs to understand nesting.
 */

import type { Company } from "@/types";
import type { GroupBy, WorkspaceNode } from "@/lib/project";

/** A group header: an engagement, a band, a category, or a status bucket. */
export interface GroupRow {
  kind: "group";
  key: string;
  node: WorkspaceNode;
  /** 0 = engagement, 1 = band, 2 = category. Drives indent and weight. */
  depth: number;
  open: boolean;
  /** True when this group has nothing under it at all. */
  empty: boolean;
}

export interface CompanyRowItem {
  kind: "company";
  key: string;
  company: Company;
  depth: number;
  /** The engagement this row sits under, for actions that need a book. */
  mandateId: number;
  /**
   * Whether the row must name its own category/engagement, because the grouping it is
   * under doesn't already say it. Computed here rather than in the component so the
   * component never has to reason about which lens it is in.
   */
  showCategory: boolean;
  showEngagement: boolean;
  /** The engagement's name, when the row has to say it. */
  engagementLabel?: string | null;
}

/** Rendered when an open group has no children — an empty book you can still fill. */
export interface EmptyRow {
  kind: "empty";
  key: string;
  node: WorkspaceNode;
  depth: number;
}

export type WorkspaceRow = GroupRow | CompanyRowItem | EmptyRow;

export interface BuildRowsOptions {
  tree: WorkspaceNode[];
  /** Paths the user has closed. Absent = open, so a new group arrives expanded. */
  isOpen: (path: string) => boolean;
  groupBy: GroupBy;
}

/**
 * Walk the tree in reading order, emitting a row per visible thing.
 *
 * A closed group emits its header and stops — its companies are not in the array at all,
 * which is what makes collapsing an actual performance lever and not just a visual one.
 */
export function buildRows({ tree, isOpen, groupBy }: BuildRowsOptions): WorkspaceRow[] {
  const rows: WorkspaceRow[] = [];
  // With no grouping below the engagement, a company row has to say its own category —
  // the column it would otherwise have inherited from a header simply isn't there.
  const flattened = groupBy === "none" || groupBy === "status" || groupBy === "flat";

  const walk = (node: WorkspaceNode, depth: number, mandateId: number) => {
    const open = isOpen(node.path);
    const empty = node.vitals.total === 0;

    rows.push({ kind: "group", key: node.path, node, depth, open, empty });
    if (!open) return;

    if (empty) {
      rows.push({ kind: "empty", key: `${node.path}/empty`, node, depth });
      return;
    }

    if (node.children.length === 0) {
      for (const c of node.companies) {
        rows.push({
          kind: "company",
          key: `${node.path}/c-${c.id}`,
          company: c,
          depth: depth + 1,
          mandateId,
          // A band header names the band but not the category under it, so a row
          // directly beneath one still has to say which category it is.
          showCategory: flattened || node.level === "band" || node.level === "status",
          showEngagement: false,
          engagementLabel: null,
        });
      }
      return;
    }

    for (const child of node.children) walk(child, depth + 1, mandateId);
  };

  for (const eng of tree) walk(eng, 0, eng.mandateId ?? 0);
  return rows;
}

/**
 * The flat lens: no groups at all, just companies in the order the sort decided.
 *
 * This is what "Needs attention" renders. It is a separate function rather than a
 * `groupBy` branch inside `buildRows` because it takes companies, not a tree — building
 * a tree only to throw its structure away would make the roll-ups (which cost a pass
 * over every company at every level) pure waste on the view that has the most rows.
 */
export function buildFlatRows(
  companies: Company[],
  engagementNames: Map<number, string>,
): WorkspaceRow[] {
  // Only name the engagement when there is more than one in play; on a single-book
  // project the label is the same word on every row, which is noise, not context.
  const multiBook = new Set(companies.map((c) => c.mandate_id)).size > 1;
  return companies.map((c) => ({
    kind: "company" as const,
    key: `flat/c-${c.id}`,
    company: c,
    depth: 0,
    mandateId: c.mandate_id,
    showCategory: true,
    showEngagement: multiBook && engagementNames.has(c.mandate_id),
    engagementLabel: engagementNames.get(c.mandate_id) ?? null,
  }));
}

/** Every collapsible path in a tree — what "collapse all" has to name. */
export function collapsiblePaths(tree: WorkspaceNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: WorkspaceNode[]) => {
    for (const n of nodes) {
      if (n.children.length > 0 || n.level === "engagement") out.push(n.path);
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

/**
 * Row heights, in px, for the virtualizer's initial estimate.
 *
 * These are estimates, not commitments — the virtualizer measures real rows as they
 * mount and corrects itself. They only need to be close enough that the scrollbar
 * doesn't jump visibly on first paint.
 */
export function estimateRowHeight(row: WorkspaceRow, dense: boolean): number {
  switch (row.kind) {
    case "group":
      return row.depth === 0 ? 46 : 30;
    case "empty":
      return 72;
    case "company":
    default:
      return dense ? 34 : 46;
  }
}
