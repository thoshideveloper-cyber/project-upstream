"use client";

/**
 * The project workspace — the analyst's operating surface.
 *
 * The previous workspace was a hierarchy with four dropdowns bolted to the top. That is
 * a good answer to "how is this project organised" and the only answer it could give.
 * Every other question — what is late, what did they reply to, what has gone quiet, what
 * is mine — had to be reassembled by hand out of the same four controls each morning.
 *
 * This version separates the three things those dropdowns had tangled:
 *
 *     a FILTER   decides which companies are in play
 *     a GROUPING decides how they are stacked
 *     a VIEW     is a named (filter, group, sort) you can return to
 *
 * so "Needs attention" and "By band" stop being different pages and become two lenses
 * over one dataset. The whole state lives in the URL, which makes a lens a link.
 *
 * Two structural consequences worth naming:
 *
 *   1. **Rows are virtualized.** The old tree capped every leaf at 40 companies behind
 *      a "show N more", which meant a group header could read 47 above a list of 40.
 *      Flattening the tree into one addressable array (`lib/workspace-rows.ts`) removes
 *      the cap entirely: a 1,000-company project mounts about thirty rows.
 *   2. **A company opens beside the list, not instead of it.** The peek panel is an
 *      overlay on the same route, so scroll, selection, expansion and filters all
 *      survive an inspection. That is the difference between working a queue and
 *      restarting one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Plus } from "lucide-react";

import { CompanyPeekHost } from "@/components/project/workspace/company-peek";
import {
  CompanyGridRow,
  EmptyGroupRow,
  EngagementHeaderRow,
  GridHeader,
  GROUP_H,
  ROW_H,
  SubGroupHeaderRow,
} from "@/components/project/workspace/grid";
import { useFilterOptions } from "@/components/project/workspace/options";
import { ResultCaption, ViewBar, type ViewState } from "@/components/project/workspace/view-bar";
import { WorkspaceBulkActions } from "@/components/project/workspace/bulk-actions";
import { useProjectShell } from "@/components/project/project-context";
import { HealthLegend } from "@/components/project/health-bar";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/use-categories";
import { useCompanies } from "@/hooks/use-companies";
import { useProjectLayerOrder } from "@/hooks/use-project-layers";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { INK_LINK, STATUS_META } from "@/lib/design";
import { buildWorkspace, filterCompanies, type GroupBy, type WorkspaceNode } from "@/lib/project";
import { cn } from "@/lib/utils";
import {
  BUILTIN_VIEWS,
  EMPTY_FILTER,
  VIEW_BY_KEY,
  filterParam,
  loadSavedViews,
  matchesFilter,
  matchesView,
  persistSavedViews,
  sortCompanies,
  type FilterGroup,
  type SavedView,
  type SortKey,
  type ViewDef,
} from "@/lib/project-views";
import { buildFlatRows, buildRows, collapsiblePaths, type WorkspaceRow } from "@/lib/workspace-rows";
import { allSelected, pruneSelection, selectedCount, toggle, toggleMany } from "@/lib/selection";
import { enumParam, intParam, stringParam, type ParamSpec } from "@/lib/table-url-state";
import type { Company } from "@/types";

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.label]),
);

const GROUPS = ["band-category", "band", "category", "status", "none", "flat"] as const;
const SORTS = ["priority", "name", "overdue", "next", "status", "recent"] as const;

/**
 * MODULE SCOPE. `useTableUrlState` deliberately leaves the spec out of its effect deps,
 * so a spec rebuilt each render would re-hydrate from the URL on every render.
 *
 * `attention` and `book` are legacy params kept alive on purpose: the project header's
 * metric rail, the overview's queue link and every bookmark anyone made before this
 * redesign all point at `?attention=late`. They are translated into the view model on
 * mount rather than supported forever.
 */
const WORKSPACE_SPEC = {
  q: stringParam(""),
  view: stringParam("all"),
  f: filterParam,
  group: enumParam(GROUPS, "band-category"),
  sort: enumParam(SORTS, "name"),
  density: enumParam(["comfortable", "dense"] as const, "comfortable"),
  peek: intParam(0),
  book: intParam(0),
  attention: enumParam(["", "any", "late", "awaiting", "no-contact"] as const, ""),
} satisfies ParamSpec;

/** Elements whose keystrokes are theirs, not the register's. */
const SKIP_KEYS_INSIDE =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [data-slot="popover-content"]';

/** Old links, in the new vocabulary. */
const LEGACY_VIEW: Record<string, string> = {
  any: "attention",
  late: "follow-ups",
  awaiting: "intro-pending",
  "no-contact": "blocked",
};

/* ── Expansion ─────────────────────────────────────────────────────────────── */

/**
 * Collapsed-by-path, not expanded-by-path.
 *
 * The default has to be open — a workspace that starts fully collapsed makes you click
 * four times before you see a company. Tracking what has been *closed* means a newly
 * imported engagement arrives open, and an empty set is the correct initial state rather
 * than one that has to be seeded from data that hasn't loaded yet.
 */
function useCollapsed() {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  return {
    isOpen: useCallback((path: string) => !closed.has(path), [closed]),
    toggle: useCallback((path: string) => {
      setClosed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    }, []),
    openAll: useCallback(() => setClosed(new Set()), []),
    closeAll: useCallback((paths: string[]) => setClosed(new Set(paths)), []),
    anyClosed: closed.size > 0,
  };
}

/* ── The view ──────────────────────────────────────────────────────────────── */

export function ProjectWorkspace() {
  const { project, engagements } = useProjectShell();

  const [url, patchUrl] = useTableUrlState(WORKSPACE_SPEC);
  const groupBy = url.group as GroupBy;
  const sort = url.sort as SortKey;
  const dense = url.density === "dense";

  const { data, isLoading, isError, refetch } = useCompanies({
    project_id: project.id,
    page_size: 1000,
    sort: "company_name",
  });
  const { data: categoriesData } = useCategories();
  const layerOrderByMandate = useProjectLayerOrder(engagements.map((e) => e.id));

  const all = useMemo(() => data?.items ?? [], [data]);

  /* ── Saved views ─────────────────────────────────────────────────────── */

  const [saved, setSaved] = useState<SavedView[]>([]);
  useEffect(() => setSaved(loadSavedViews(project.id)), [project.id]);

  const allViews = useMemo<ViewDef[]>(() => [...BUILTIN_VIEWS, ...saved], [saved]);
  const view = useMemo(
    () => allViews.find((v) => v.key === url.view) ?? VIEW_BY_KEY.all,
    [allViews, url.view],
  );

  const state: ViewState = {
    viewKey: view.key,
    filter: url.f,
    group: groupBy,
    sort,
    q: url.q,
    dense,
  };

  // "Edited" means the live state has drifted from the view it claims to be. Shown
  // rather than silently reassigned, because a lens whose name stops describing it is
  // how a user loses trust in the whole picker.
  const dirty = !matchesView(view, { filter: url.f, group: groupBy, sort });

  const applyView = useCallback(
    (v: ViewDef) =>
      patchUrl({ view: v.key, f: v.filter, group: v.group, sort: v.sort, peek: 0 }),
    [patchUrl],
  );

  /**
   * Legacy links, translated once.
   *
   * `?attention=late` and `?book=` predate the view system and are still emitted by the
   * header rail, the overview and anyone's bookmarks. Rewriting them into (view, filter)
   * on arrival means there is exactly one query language inside the workspace, and the
   * old one keeps working without a second code path evaluating it on every render.
   */
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;

    /*
     * Read the query directly, not the hydrated state.
     *
     * `useTableUrlState` decodes the URL in its own mount effect, which has run by the
     * time this one does — but the values closed over here are still this render's,
     * i.e. the pre-hydration defaults. Reading `location.search` is the only way to see
     * what the user actually arrived with, and this effect has to be right the first
     * time because it only ever runs once.
     */
    const search = new URLSearchParams(window.location.search);
    const attention = search.get("attention") ?? "";
    const book = Number(search.get("book") ?? 0) || 0;

    if (attention || book) {
      const target = attention ? VIEW_BY_KEY[LEGACY_VIEW[attention]] : null;
      const bookCond = book
        ? [{ id: "legacy-book", field: "engagement" as const, op: "any_of" as const, values: [book] }]
        : [];
      patchUrl({
        attention: "",
        book: 0,
        ...(target && {
          view: target.key,
          group: target.group,
          sort: target.sort,
        }),
        f: {
          join: "and",
          conditions: [...(target?.filter.conditions ?? []), ...bookCond],
        } as FilterGroup,
      });
      return;
    }

    /*
     * A view named in the URL but not spelled out.
     *
     * `?view=attention` is the short form every drill-through from analytics uses, and
     * it has to mean the whole lens — its filter, its grouping, its sort — not just a
     * label above the unfiltered book. So a view key with no explicit `f` adopts the
     * view's own triple on arrival. Once the user edits anything, `f`, `group` and
     * `sort` are all in the URL, so this never fires again — which is what stops an
     * edited view being silently reset on reload.
     */
    const named = search.get("view");
    if (named && !search.has("f")) {
      const def = VIEW_BY_KEY[named];
      if (def) {
        patchUrl({
          f: def.filter,
          ...(search.has("group") ? {} : { group: def.group }),
          ...(search.has("sort") ? {} : { sort: def.sort }),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── The data pipeline ───────────────────────────────────────────────── */

  /**
   * Search and filter, in that order and from one definition each.
   *
   * `filterCompanies` owns what a free-text search covers (name, HQ, category, band,
   * the primary contact's name and address) and is shared with the other surfaces that
   * search a book; `matchesFilter` owns the condition model. Re-spelling the search
   * haystack here would give the workspace a quietly different idea of what "search"
   * means from every other list in the product.
   */
  const filtered = useMemo(
    () => filterCompanies(all, { q: url.q }).filter((c) => matchesFilter(c, url.f)),
    [all, url.q, url.f],
  );

  const sortLeaf = useCallback((list: Company[]) => sortCompanies(list, sort), [sort]);

  // Bands are defined per engagement, so a project-wide band list is a union. Only
  // needed to label filter options; the tree gets its order per mandate.
  const bandOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const c of all) {
      if (c.sourcing_layer_id != null && c.sourcing_layer_name) {
        seen.set(c.sourcing_layer_id, c.sourcing_layer_name);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [all]);

  const options = useFilterOptions({
    companies: all,
    engagements,
    categories: categoriesData?.items ?? [],
    bands: bandOptions,
  });

  const categoryOrder = useMemo(
    () => (categoriesData?.items ?? []).map((c) => c.id),
    [categoriesData],
  );

  const flat = groupBy === "flat";

  const tree = useMemo(
    () =>
      flat
        ? []
        : buildWorkspace({
            companies: filtered,
            engagements,
            groupBy,
            layerOrderByMandate,
            categoryOrder,
            statusLabels: STATUS_LABELS,
            sortLeaf,
          }),
    [flat, filtered, engagements, groupBy, layerOrderByMandate, categoryOrder, sortLeaf],
  );

  const { isOpen, toggle: toggleGroup, openAll, closeAll, anyClosed } = useCollapsed();

  const engagementNames = useMemo(
    () => new Map(engagements.map((e) => [e.id, e.name])),
    [engagements],
  );

  const rows: WorkspaceRow[] = useMemo(
    () =>
      flat
        ? buildFlatRows(sortCompanies(filtered, sort), engagementNames)
        : buildRows({ tree, isOpen, groupBy }),
    [flat, filtered, sort, engagementNames, tree, isOpen, groupBy],
  );

  const allPaths = useMemo(() => (flat ? [] : collapsiblePaths(tree)), [flat, tree]);
  const scaleTo = useMemo(
    () => Math.max(1, ...tree.map((n) => n.vitals.total)),
    [tree],
  );

  /* ── Selection ───────────────────────────────────────────────────────── */

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered]);

  // A selection that survives the rows leaving the screen is a bulk action fired at
  // records the user can no longer see. Prune on every narrowing.
  useEffect(() => {
    setSelected((prev) => (prev.size === 0 ? prev : pruneSelection(prev, visibleIds)));
  }, [visibleIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  /* ── Peek ────────────────────────────────────────────────────────────── */

  const peekId = url.peek || null;
  const peekRow = useMemo(
    () => (peekId ? all.find((c) => c.id === peekId) : undefined),
    [all, peekId],
  );

  // A peeked record that the filter just excluded would leave a panel describing a row
  // nobody can see. Close it rather than keep a ghost open.
  useEffect(() => {
    if (peekId && !visibleIds.includes(peekId)) patchUrl({ peek: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peekId, visibleIds]);

  /* ── Virtualization ──────────────────────────────────────────────────── */

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = useCallback(
    (i: number) => {
      const r = rows[i];
      if (!r) return ROW_H.comfortable;
      if (r.kind === "group") return r.depth === 0 ? GROUP_H.engagement : GROUP_H.sub;
      if (r.kind === "empty") return 56;
      return dense ? ROW_H.compact : ROW_H.comfortable;
    },
    [rows, dense],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: rowHeight,
    overscan: 12,
    getItemKey: (i) => rows[i]?.key ?? i,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Switching Comfortable/Compact changes every row's height at once. The virtualizer
  // caches sizes per item, so without an explicit re-measure the offsets keep describing
  // the old density and the list scrolls to the wrong place.
  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dense]);

  /**
   * Where each engagement header starts, in scroll pixels.
   *
   * Row heights are declared rather than measured (see `ROW_H`), so the offsets are a
   * plain running total — no dependency on the virtualizer's internal measurement
   * cache, and correct on the very first frame rather than after the first scroll.
   * Only the engagement rows are kept: there are three of them in a project, not three
   * hundred, so finding the current one is a walk over a handful of entries.
   */
  const bookStarts = useMemo(() => {
    if (flat) return [] as { index: number; start: number }[];
    const out: { index: number; start: number }[] = [];
    let y = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.kind === "group" && r.depth === 0 && r.node.engagement) out.push({ index: i, start: y });
      y += rowHeight(i);
    }
    return out;
  }, [flat, rows, rowHeight]);

  /**
   * The engagement header for whichever book the viewport is currently inside.
   *
   * Scrolling to row 200 of a three-book project without this leaves nothing on screen
   * saying which book you are reading. It renders only once its real row has actually
   * gone under the top edge — pinning it while the real one is still visible draws the
   * same header twice, which is what the first version of this did.
   */
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const pinned = useMemo(() => {
    let found: WorkspaceRow | null = null;
    for (const b of bookStarts) {
      if (b.start >= scrollOffset) break;
      found = rows[b.index];
    }
    return found?.kind === "group" ? found : null;
  }, [bookStarts, rows, scrollOffset]);

  /* ── Working the queue from the keyboard ─────────────────────────────── */

  /**
   * ↑/↓ (or k/j) walk the register; Enter opens the record beside it.
   *
   * This is the step the brief's analyst day turns on: review a company, act, move to
   * the next one. Doing that with the mouse costs a scroll, a hunt for the next row and
   * a click per record, which is why queues get abandoned at row twelve. With the panel
   * open the arrows move the panel too, so the whole loop is two keys.
   *
   * Deliberately global rather than a roving tabindex on 300 rows: only the cursor row
   * is focusable, and `aria-activedescendant` on the grid tells a screen reader which
   * row that is without moving DOM focus off the grid.
   */
  const companyIndexes = useMemo(
    () => rows.reduce<number[]>((out, r, i) => (r.kind === "company" ? (out.push(i), out) : out), []),
    [rows],
  );

  const [cursor, setCursor] = useState<number | null>(null);

  /**
   * The cursor, mirrored where an event handler can read it synchronously.
   *
   * Two keydowns can arrive in the same tick — holding ↓ does exactly that — and both
   * would close over the same rendered `cursor`, so the second press would recompute
   * from the position the first one already left. The ref is the live value; state is
   * what renders. Without this, a held arrow key skips every other row.
   */
  const cursorRef = useRef<number | null>(null);
  const setCursorAt = useCallback((next: number | null) => {
    cursorRef.current = next;
    setCursor(next);
  }, []);

  // The cursor is an index into a list that filtering and grouping rebuild. Anchoring it
  // to the row's identity means a filter change moves the highlight with the record
  // rather than leaving it pointing at whatever row inherited that position.
  const cursorKey = cursor != null ? rows[cursor]?.key : undefined;
  useEffect(() => {
    if (cursorKey == null) return;
    const found = rows.findIndex((r) => r.key === cursorKey);
    if (found !== cursor) setCursorAt(found === -1 ? null : found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const peekOpen = peekId != null;
  const move = useCallback(
    (delta: number) => {
      if (companyIndexes.length === 0) return;
      const current = cursorRef.current;
      const at = current == null ? -1 : companyIndexes.indexOf(current);
      const nextPos =
        at === -1
          ? delta > 0
            ? 0
            : companyIndexes.length - 1
          : Math.max(0, Math.min(companyIndexes.length - 1, at + delta));
      const idx = companyIndexes[nextPos];
      setCursorAt(idx);
      virtualizer.scrollToIndex(idx, { align: "auto" });
      const row = rows[idx];
      // With the panel already open, moving the cursor is moving through the queue.
      if (peekOpen && row?.kind === "company") patchUrl({ peek: row.company.id });
    },
    [companyIndexes, peekOpen, rows, virtualizer, patchUrl, setCursorAt],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Never steal a keystroke from a field, a menu, or a dialog — "j" belongs to
      // whatever the user is typing into far more often than it belongs to the list.
      // `instanceof` rather than a cast: an event dispatched at `window` (or fired
      // before focus lands anywhere) has a target with no `closest`, and calling it
      // would take the whole handler down rather than skipping one keystroke.
      const t = e.target;
      if (t instanceof Element && t.closest(SKIP_KEYS_INSIDE)) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter" && cursor != null) {
        const row = rows[cursor];
        if (row?.kind === "company") {
          e.preventDefault();
          patchUrl({ peek: row.company.id });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, cursor, rows, patchUrl]);

  /* ── Empty and error states ──────────────────────────────────────────── */

  // Above the early return: every hook this component calls has to run on every
  // render, and a project with no engagements is still a render of this component.
  const focusedBook = useSingleEngagementFilter(url.f);

  if (engagements.length === 0) return <NoEngagements />;

  const narrowed = filtered.length !== all.length;

  const clearAll = () =>
    patchUrl({ q: "", f: EMPTY_FILTER, view: "all", group: "band-category", sort: "name" });

  return (
    <div className="flex flex-col gap-3">
      <ViewBar
        state={state}
        view={view}
        dirty={dirty}
        saved={saved}
        options={options}
        anyClosed={anyClosed}
        onPatch={(p) =>
          patchUrl({
            ...(p.q !== undefined && { q: p.q }),
            ...(p.filter !== undefined && { f: p.filter }),
            ...(p.group !== undefined && { group: p.group }),
            ...(p.sort !== undefined && { sort: p.sort }),
            ...(p.dense !== undefined && { density: p.dense ? "dense" : "comfortable" }),
          })
        }
        onPickView={applyView}
        onSaveView={(name) => {
          const next: SavedView = {
            key: `saved-${Date.now()}`,
            label: name,
            hint: "Your own view",
            filter: url.f,
            group: groupBy,
            sort,
            saved: true,
            createdAt: new Date().toISOString(),
          };
          const list = [...saved, next];
          setSaved(list);
          persistSavedViews(project.id, list);
          patchUrl({ view: next.key });
        }}
        onDeleteSavedView={(key) => {
          const list = saved.filter((v) => v.key !== key);
          setSaved(list);
          persistSavedViews(project.id, list);
          if (url.view === key) patchUrl({ view: "all" });
        }}
        onToggleExpand={() => (anyClosed ? openAll() : closeAll(allPaths))}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <ResultCaption
          shown={filtered.length}
          total={all.length}
          hint={view.hint}
          onClear={narrowed ? clearAll : undefined}
        />
        {!flat && <HealthLegend />}
      </div>

      {/* The register and the panel share one bordered surface, so opening a record
          reads as widening the same object rather than covering it with a new one. */}
      <div className="flex min-h-0 overflow-hidden rounded-lg bg-card ring-1 ring-border">
        {/* Below `lg` the panel takes the whole surface: 400px of register beside
            400px of panel is two unusable columns, not a split view. */}
        <div
          className={cn(
            "min-w-0 flex-1 flex-col",
            peekId ? "hidden lg:flex" : "flex",
          )}
        >
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-9 animate-pulse rounded-md bg-ink-100" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />
              <p className="text-sm font-medium">Couldn&rsquo;t load this project&rsquo;s book.</p>
              <button onClick={() => refetch()} className={cn(INK_LINK, "text-xs")}>
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="text-sm text-foreground">Nothing matches this view.</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                {narrowed ? (
                  <>
                    {all.length} companies are in the book —{" "}
                    <button onClick={clearAll} className={INK_LINK}>
                      clear the filters
                    </button>{" "}
                    to see them.
                  </>
                ) : (
                  "This project has no companies yet."
                )}
              </p>
            </div>
          ) : (
            // `@container`: the register's columns respond to the register's own
            // width, which the peek panel changes without the window moving at all.
            <div
              role="grid"
              aria-label="Companies in this project"
              aria-rowcount={rows.length}
              aria-activedescendant={cursorKey ? `wsrow-${cursorKey}` : undefined}
              className="@container flex min-h-0 flex-col"
              data-testid="grid-table"
            >
              <GridHeader
                allChecked={allSelected(selected, visibleIds)}
                someChecked={selectedCount(selected, visibleIds) > 0}
                onToggleAll={() => setSelected((s) => toggleMany(s, visibleIds))}
                showSignal={sort === "priority"}
              />

              {/* A fixed viewport height is what makes virtualization possible at all —
                  the scroll container has to be the measured element, not the page. */}
              <div
                ref={scrollRef}
                className="overflow-auto"
                style={{ height: "min(68vh, 760px)" }}
              >
                {/*
                  The book you are currently inside, pinned.
                  Sticky, with a matching negative margin so it occupies no space in
                  flow — the virtualized rows below are absolutely positioned and would
                  otherwise all shift down by its height. A `position: sticky` on the
                  rows themselves cannot work: they are already `position: absolute`.
                */}
                {pinned && (
                  <div
                    className="sticky top-0 z-20"
                    style={{ height: GROUP_H.engagement, marginBottom: -GROUP_H.engagement }}
                  >
                    <EngagementHeaderRow
                      row={pinned}
                      scaleTo={scaleTo}
                      showRate={!narrowed}
                      focused={focusedBook === pinned.node.engagement!.id}
                      onToggle={() => toggleGroup(pinned.node.path)}
                      onFocus={() =>
                        patchUrl({
                          f: engagementFilter(
                            url.f,
                            focusedBook === pinned.node.engagement!.id
                              ? 0
                              : pinned.node.engagement!.id,
                          ),
                        })
                      }
                      selected={selectedGroup(selected, pinned) === "all"}
                      someSelected={selectedGroup(selected, pinned) !== "none"}
                      onToggleSelect={() =>
                        setSelected((sel) =>
                          toggleMany(sel, pinned.node.companies.map((c) => c.id)),
                        )
                      }
                    />
                  </div>
                )}
                <div
                  style={{ height: virtualizer.getTotalSize(), position: "relative" }}
                >
                  {virtualRows.map((item) => {
                    const row = rows[item.index];
                    if (!row) return null;
                    return (
                      <div
                        key={item.key}
                        data-index={item.index}
                        className="absolute inset-x-0 top-0"
                        style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                      >
                        <RenderRow
                          row={row}
                          cursor={cursor === item.index}
                          tree={tree}
                          dense={dense}
                          showSignal={sort === "priority"}
                          scaleTo={scaleTo}
                          selected={selected}
                          peekId={peekId}
                          focusedBook={focusedBook}
                          showRate={!narrowed}
                          narrowed={narrowed}
                          onToggleGroup={toggleGroup}
                          onToggleSelect={(id) => setSelected((s) => toggle(s, id))}
                          onToggleGroupSelect={(ids) => setSelected((s) => toggleMany(s, ids))}
                          onPeek={(id) => {
                            // Clicking a row is also placing the cursor: ↓ afterwards
                            // continues from the record you just opened, not from
                            // wherever the keyboard last was.
                            setCursorAt(item.index);
                            patchUrl({ peek: id });
                          }}
                          onFocus={(id) => patchUrl({ f: engagementFilter(url.f, id) })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <CompanyPeekHost
          companyId={peekId}
          row={peekRow}
          onClose={() => patchUrl({ peek: 0 })}
        />
      </div>

      <WorkspaceBulkActions
        selected={selected}
        companies={all}
        onClear={clearSelection}
      />
    </div>
  );
}

/* ── Row dispatch ──────────────────────────────────────────────────────────── */

function RenderRow({
  row,
  cursor,
  tree,
  dense,
  showSignal,
  scaleTo,
  selected,
  peekId,
  focusedBook,
  showRate,
  narrowed,
  onToggleGroup,
  onToggleSelect,
  onToggleGroupSelect,
  onPeek,
  onFocus,
}: {
  row: WorkspaceRow;
  cursor: boolean;
  tree: WorkspaceNode[];
  dense: boolean;
  showSignal: boolean;
  scaleTo: number;
  selected: Set<number>;
  peekId: number | null;
  focusedBook: number;
  showRate: boolean;
  /** True while a search or filter is narrowing the book — see EmptyGroupRow. */
  narrowed: boolean;
  onToggleGroup: (path: string) => void;
  onToggleSelect: (id: number) => void;
  onToggleGroupSelect: (ids: number[]) => void;
  onPeek: (id: number) => void;
  onFocus: (id: number) => void;
}) {
  if (row.kind === "company") {
    return (
      <CompanyGridRow
        row={row}
        dense={dense}
        cursor={cursor}
        showSignal={showSignal}
        selected={selected.has(row.company.id)}
        peeked={peekId === row.company.id}
        onToggleSelect={() => onToggleSelect(row.company.id)}
        onPeek={() => onPeek(row.company.id)}
      />
    );
  }

  const mandate = mandateOf(row.node, tree);

  if (row.kind === "empty") {
    return <EmptyGroupRow depth={row.depth} mandate={narrowed ? null : mandate} />;
  }

  const ids = row.node.companies.map((c) => c.id);
  const picked = selectedCount(selected, ids);

  if (row.depth === 0 && row.node.engagement) {
    return (
      <EngagementHeaderRow
        row={row}
        scaleTo={scaleTo}
        showRate={showRate}
        focused={focusedBook === row.node.engagement.id}
        onToggle={() => onToggleGroup(row.node.path)}
        onFocus={() => onFocus(focusedBook === row.node.engagement!.id ? 0 : row.node.engagement!.id)}
        selected={ids.length > 0 && picked === ids.length}
        someSelected={picked > 0}
        onToggleSelect={() => onToggleGroupSelect(ids)}
      />
    );
  }

  return (
    <SubGroupHeaderRow
      row={row}
      mandate={mandate}
      onToggle={() => onToggleGroup(row.node.path)}
      selected={ids.length > 0 && picked === ids.length}
      someSelected={picked > 0}
      onToggleSelect={() => onToggleGroupSelect(ids)}
    />
  );
}

/** Whether a group is fully, partly, or not selected. */
function selectedGroup(selected: Set<number>, row: WorkspaceRow & { kind: "group" }) {
  const ids = row.node.companies.map((c) => c.id);
  if (ids.length === 0) return "none";
  const n = selectedCount(selected, ids);
  return n === 0 ? "none" : n === ids.length ? "all" : "some";
}

/** The engagement a node sits under — group rows need one to file a new company into. */
function mandateOf(node: WorkspaceNode, tree: WorkspaceNode[]) {
  const engId = Number(node.path.match(/^eng-(\d+)/)?.[1] ?? 0);
  const eng = tree.find((n) => n.mandateId === engId)?.engagement;
  return eng ? { id: eng.id, name: eng.name, type: eng.type } : null;
}

/* ── Engagement focus, expressed as a filter ───────────────────────────────── */

/** The single engagement the filter currently pins to, or 0. */
function useSingleEngagementFilter(f: FilterGroup): number {
  return useMemo(() => {
    const c = f.conditions.find((x) => x.field === "engagement" && x.op === "any_of");
    return c && c.values.length === 1 ? Number(c.values[0]) : 0;
  }, [f]);
}

/**
 * "Focus this book" is not a fifth piece of state — it writes an engagement condition
 * into the same filter everything else reads. One query language, so the toolbar chip
 * shows the focus and removing the chip un-focuses.
 */
function engagementFilter(f: FilterGroup, id: number): FilterGroup {
  const rest = f.conditions.filter((c) => c.field !== "engagement");
  if (!id) return rest.length ? { ...f, conditions: rest } : EMPTY_FILTER;
  return {
    join: f.join,
    conditions: [
      ...rest,
      { id: "focus", field: "engagement", op: "any_of", values: [id] },
    ],
  };
}

/* ── Empty project ─────────────────────────────────────────────────────────── */

function NoEngagements() {
  const { project, openAddEngagement } = useProjectShell();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-subtle py-16 text-center ring-1 ring-border">
      <p className="text-sm font-semibold">No engagements in this project yet.</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        A project holds one book per engagement — sell-side, buy-side, or a capital raise
        under {project.client_name}. Open the first one, or bring the client&rsquo;s
        workbook over from Excel.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={openAddEngagement}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Add engagement
        </Button>
        <Link href="/import">
          <Button size="sm" variant="outline">
            Import from Excel
          </Button>
        </Link>
      </div>
    </div>
  );
}
