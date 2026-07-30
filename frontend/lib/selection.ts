/**
 * Pure, React-free helpers for row-selection sets (P2 bulk actions).
 *
 * Selection is modelled as an immutable `Set<number>` of ids; every operation
 * returns a *new* set so React state updates stay referentially honest. Kept free
 * of hooks so the toggle/select-all semantics are unit-testable in isolation.
 */

/** Add `id` if absent, remove it if present. */
export function toggle(selected: Set<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** How many of `ids` are currently selected. */
export function selectedCount(selected: Set<number>, ids: number[]): number {
  let n = 0;
  for (const id of ids) if (selected.has(id)) n += 1;
  return n;
}

/** True when every id in a non-empty group is selected. */
export function allSelected(selected: Set<number>, ids: number[]): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

/**
 * Select-all toggle for a group: if every id is already in, remove them all
 * (clear the group); otherwise add the missing ones. Leaves ids outside the group
 * untouched, so per-section select-all composes across a multi-group table.
 */
export function toggleMany(selected: Set<number>, ids: number[]): Set<number> {
  const next = new Set(selected);
  if (allSelected(next, ids)) {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
  }
  return next;
}

/** Drop any selected id that is no longer present in `validIds` (e.g. after a
 *  filter change or a refetch removed rows) — keeps the bulk bar count honest. */
export function pruneSelection(selected: Set<number>, validIds: Iterable<number>): Set<number> {
  const valid = validIds instanceof Set ? validIds : new Set(validIds);
  const next = new Set<number>();
  for (const id of selected) if (valid.has(id)) next.add(id);
  return next.size === selected.size ? selected : next;
}
