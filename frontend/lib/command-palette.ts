/**
 * Pure helpers for the global command palette (⌘K).
 *
 * Kept free of React / lucide so the matching + keyboard-index logic is unit-testable
 * in isolation. The component (components/features/command-palette.tsx) attaches icons
 * and wires these into the rendered list.
 */

export type PaletteItemKind =
  | "action"
  | "page"
  | "project"
  | "mandate"
  | "company"
  | "contact";

export interface PaletteItem {
  /** DOM-safe, stable id — used for aria-activedescendant + scroll-into-view. */
  id: string;
  kind: PaletteItemKind;
  label: string;
  sublabel?: string;
  /** Extra text folded into matching but not displayed. */
  keywords?: string;
  /** Navigation target (jump-to items). */
  href?: string;
  /** Action key (non-navigating items, e.g. "new-company"). */
  action?: string;
}

export interface PaletteGroup<T extends PaletteItem = PaletteItem> {
  heading: string;
  items: T[];
}

/**
 * Token-AND substring match: every whitespace-separated token in `query` must appear
 * somewhere in the concatenated fields. Empty query matches everything.
 */
export function matches(query: string, ...fields: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((tok) => hay.includes(tok));
}

export function itemMatches(item: PaletteItem, query: string): boolean {
  return matches(query, item.label, item.sublabel, item.keywords);
}

/**
 * Filter each group's items by `query`, dropping groups that end up empty.
 * Order is preserved so the flat keyboard index stays predictable.
 */
export function filterGroups<T extends PaletteItem>(
  groups: PaletteGroup<T>[],
  query: string,
): PaletteGroup<T>[] {
  const q = query.trim();
  const kept: PaletteGroup<T>[] = [];
  for (const g of groups) {
    const items = q ? g.items.filter((i) => itemMatches(i, q)) : g.items;
    if (items.length) kept.push({ ...g, items });
  }
  return kept;
}

/** Flatten groups into a single ordered list for arrow-key navigation. */
export function flattenGroups<T extends PaletteItem>(groups: PaletteGroup<T>[]): T[] {
  return groups.flatMap((g) => g.items);
}

/**
 * Move the highlighted index by `delta`, wrapping at both ends.
 * Returns 0 for an empty list so callers never index out of bounds.
 */
export function moveIndex(current: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}
