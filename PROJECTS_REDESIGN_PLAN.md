# Projects page redesign — implementation plan (handoff)

Status date: 2026-07-18. Phases 1–3 (research, audit, UX plan) are DONE. Backend work is
DONE and tested. What remains is the frontend build + verification. This document is the
complete spec — follow it exactly; every design decision below was made deliberately
against the app's established design system.

---

## 0. What is already done (do not redo)

### Backend — committed to working tree, tests green
1. **`backend/app/api/projects.py` — rewritten.**
   - New batched helper `_mandate_rollups(db, mandate_ids) -> dict[mandate_id, dict]`
     (5 queries total, no N+1). Per mandate returns: `total_companies, responded,
     response_rate, overdue_count, cold_count, needs_initial_count,
     last_activity (ISO date str | None), analysts ([{id, full_name}])`.
   - `GET /projects` list items now ALSO carry:
     `sides` (`{"SELL_SIDE": {engagements, companies}, "BUY_SIDE": …, "CAPITAL_RAISE": …}`),
     `total_companies, responded, response_rate, overdue_count, cold_count,
     needs_initial_count, last_activity, team (sorted analyst full-name list)`,
     and `mandate_count` (now = VISIBLE mandate count for analysts).
   - `GET /projects/{id}` engagement dicts now also carry `last_activity` and
     `analysts`; `headline` now also carries `needs_initial_count` and `last_activity`.
   - `POST /projects` is now **CurrentUser** (analysts can create). PATCH/DELETE/
     unarchive remain partner-only.
2. **`backend/app/api/mandates.py`** — `POST /mandates` is now **CurrentUser**;
   auto-assigns the CREATOR (plus lead owner, deduped via a set) so an analyst's new
   engagement is immediately visible to them. PATCH/archive/assignments remain
   partner-only.
3. **Tests updated + passing** (`./.venv/Scripts/python.exe -m pytest` from `backend/`):
   - `tests/test_slice3.py::test_create_project_analyst_allowed` (was …_forbidden)
   - `tests/test_mandates.py::test_create_mandate_analyst_auto_assigned` (was …_403)
   - Fixed missing `await db.refresh(project)` in unarchive route.
   - `pytest tests/test_slice3.py tests/test_mandates.py` → 32 passed.

### Research conclusions (Phase 1–2, already decided — the "why" for the build)
- Current `/projects` list = generic DataTable + 3 decorative stat chips → tells the
  analyst nothing (no deal shape, no urgency). Current `/projects/[id]` = a "hallway"
  (hero box + 5 StatCards whose only real action is a tiny "Open grid →" link).
  Current grid = functional mechanics, old visual language.
- **IA change (core decision): detail + grid merge into ONE "deal room" page.**
  `/projects/[id]` = masthead → book rail (engagement tabs) → the selected
  engagement's working grid inline. `/projects/[id]/grid?mandate_id=N` becomes a
  client redirect to `/projects/[id]?book=N`.
- Legacy `/mandates` + `/mandates/[id]` pages are orphaned (nothing links to them;
  nav has no entry). DELETE both after moving team management into the deal room.
- Vitest tests (`frontend/tests/projects.test.ts`, `grid.test.ts`, `mandates.test.tsx`)
  are pure-function mirrors — they pass regardless of page changes. Keep them.

---

## 1. Design system constraints (MUST match — this is the app's established language)

- **Dark-first "obsidian amber"** theme, tokens already in `frontend/app/globals.css`.
  No new colors. Amber `var(--primary)` = the one warm accent; destructive red = the
  ONLY loud tone (late work); indigo = first-outreach/"new"; emerald = replied;
  side hues: Sell=emerald, Buy=sky, Raise=violet (pastel `/[0.08]` bg chips).
- **Fonts**: `const DISPLAY = { fontFamily: "var(--font-display)" }` (Cormorant —
  TITLES ONLY, never numerals: its old-style figures break numbers);
  `const MONO = { fontFamily: "var(--font-mono)" }` (JetBrains Mono — ALL data
  numerals, dates, counts); body = Outfit (default).
- **Status = dot + label, never a pill**:
  ```ts
  const STATUS_META: Record<CompanyStatus, { label: string; dot: string }> = {
    NOT_CONTACTED: { label: "Not contacted", dot: "bg-muted-foreground/50" },
    CONTACTED: { label: "Contacted", dot: "bg-sky-500" },
    RESPONDED: { label: "Responded", dot: "bg-emerald-500" },
    INTERESTED: { label: "Interested", dot: "bg-violet-500" },
    DECLINED: { label: "Declined", dot: "bg-amber-500" },
    BOUNCED: { label: "Bounced", dot: "bg-destructive" },
  };
  ```
- **Deal-type chips** (identical to Schedule/Master):
  ```ts
  const DEAL_TYPE_STYLE: Record<MandateType, string> = {
    SELL_SIDE: "bg-emerald-500/[0.08] text-emerald-700/90 dark:text-emerald-300/80",
    BUY_SIDE: "bg-sky-500/[0.08] text-sky-700/90 dark:text-sky-300/80",
    CAPITAL_RAISE: "bg-violet-500/[0.08] text-violet-700/90 dark:text-violet-300/80",
  };
  const DEAL_TYPE_LABEL = { SELL_SIDE: "Sell-side", BUY_SIDE: "Buy-side", CAPITAL_RAISE: "Capital raise" };
  const DEAL_TYPE_SHORT = { SELL_SIDE: "Sell", BUY_SIDE: "Buy", CAPITAL_RAISE: "Raise" };
  // Solid bar colors for the sides spectrum (bar segments, 60–80% opacity):
  const SIDE_BAR: Record<MandateType, string> = {
    SELL_SIDE: "bg-emerald-500/70", BUY_SIDE: "bg-sky-500/70", CAPITAL_RAISE: "bg-violet-500/70",
  };
  ```
- **Mandate status** (engagement lifecycle) = dot + lowercase label, not a pill:
  ACTIVE emerald dot (usually omitted — active is the default, silence), ON_HOLD amber
  dot "on hold", CLOSED muted dot "closed", TERMINATED destructive dot "terminated".
- Table header cells: `whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold
  uppercase tracking-[0.12em] text-muted-foreground` (call it `TH_CLS`).
- Select styling: `const SELECT_CLS = "h-9 rounded-lg border border-input bg-transparent
  px-2.5 text-sm outline-none transition-colors focus-visible:ring-2
  focus-visible:ring-ring/50 dark:bg-input/30"`.
- Page wrapper (matches Schedule/Master/Contacts):
  `<div className="flex flex-col gap-4 p-4 duration-300 animate-in fade-in-0 sm:p-6">`
- Row hover rail already in globals.css: class `grid-row` (amber inset rail on hover).
- Underbar grow-in animation already in globals.css: class `horizon-load`
  (+ `--load-delay` custom prop). REUSE it for all new bars; add NO new keyframes.
- Actions are **quiet-until-hover**: `variant="outline"` `h-7 text-xs font-normal` that
  gains `group-hover:border-primary/40 group-hover:bg-primary
  group-hover:text-primary-foreground` on row hover; split with a `-ml-px h-7 w-6
  rounded-l-none px-0` chevron button opening a DropdownMenu.
- **Copy**: sentence case, concrete verbs ("Send intro", "Log follow-up", "Mark
  replied"), "replied" (not "responded") in vitals, "intro pending" for AWAITING_INITIAL,
  "late" (red) for overdue. Numerals always mono.
- **The signature element (spend boldness here ONLY): the "book bar" family** —
  typed, load-proportional, honest bars:
  - List page: **sides spectrum** per project row (segments = engagement types,
    width ∝ companies, global scale across rows).
  - Deal room: **book rail** cells with a state-segmented underbar per engagement.
  Everything else stays quiet registry grammar.
- Known AI-default looks to avoid (the old page IS one): stat-card KPI grids,
  progress-ring/meter cards, status pills, 3-col card grids, cream/serif/terracotta.

---

## 2. Frontend types — `frontend/types/index.ts`

Extend (all optional so older fixtures still typecheck):

```ts
export interface ProjectSideMix { engagements: number; companies: number; }

export interface Project {
  // …existing fields…
  mandate_count?: number;
  sides?: Record<MandateType, ProjectSideMix>;
  total_companies?: number;
  responded?: number;
  response_rate?: number;
  overdue_count?: number;
  cold_count?: number;
  needs_initial_count?: number;
  last_activity?: string | null;
  team?: string[];
}

export interface EngagementAnalyst { id: number; full_name: string; }

export interface MandateEngagementStats {
  // …existing fields…
  last_activity?: string | null;
  analysts?: EngagementAnalyst[];
}

export interface ProjectHeadline {
  // …existing fields…
  needs_initial_count?: number;
  last_activity?: string | null;
}
```

No hook changes needed in `use-projects.ts` (response shapes are supersets).
In `hooks/use-mandates.ts`: make `useAssignUser`/`useUnassignUser` ALSO invalidate
`["project"]` and `["projects"]` (team shows on the new pages).

---

## 3. Projects list page — REWRITE `frontend/app/(app)/projects/page.tsx`

**Identity: "the deal floor" — every client deal on the desk, its shape and health.**

### Layout (top → bottom)
1. **Command line** (flex-wrap row, like Schedule's):
   - Left: `<h1>` "Projects" (DISPLAY font, `text-xl font-semibold tracking-tight`,
     letterSpacing "-0.5px"). Under it a vitals caption (only when data loaded):
     `<p className="mt-1 text-xs text-muted-foreground">` →
     `{n} projects · {e} engagements · {c} companies` then, if >0:
     ` · ` `<span className="font-medium text-destructive">{late} late</span>` and
     ` · {intro} intro pending` (indigo `text-indigo-400/90`). All numerals
     `<span className="font-medium tabular-nums text-foreground" style={MONO}>`.
     Sums computed client-side over loaded items (fetch with `page_size=100`: add an
     optional arg to `useProjects` or inline `useQuery` — simplest: change
     `useProjects` to request `?page_size=100`).
   - Right tools: search input (h-9 w-36 focus:w-56, Search icon, `/` focuses it via
     a keydown listener; filters client-side over name+client_name), "Show archived"
     quiet toggle chip (existing behavior, restyle: `aria-pressed`, border-input,
     amber border+bg when on), and **New project** amber button (`size="sm"`,
     `<Plus/>` icon) — visible to ALL roles now.
2. **The ledger** — one container `overflow-hidden rounded-xl border border-border/70
   bg-card`, rows separated by `border-t border-border/50` (no table, flex rows).

### ProjectRow anatomy
`<div className="group relative flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5
transition-colors hover:bg-muted/40 animate-in fade-in slide-in-from-bottom-1"
style={{ animationDelay: `${Math.min(i,10)*30}ms` }}>` — entire row clickable
(`onClick={() => router.push(...)}` + `cursor-pointer`), with a real `<Link>` on the
name (stopPropagation not needed; menus need `e.stopPropagation()` / `onClick` guards).

- **Block 1 (identity, `min-w-0 grow basis-64`)**:
  - Line 1: project name `<Link href={/projects/${id}}>` `text-[15px] font-semibold
    tracking-tight hover:text-primary` + (if `archived_at`) a muted "Archived" chip
    `rounded bg-muted px-1.5 py-px text-[11px] text-muted-foreground`.
  - Line 2 (quiet, `mt-0.5 text-xs text-muted-foreground truncate`):
    `{client_name}` ONLY if it differs from name, `· {mandate_count} engagement(s)`,
    `· Last activity {fmtDate(last_activity)}` (mono for the date) or
    `· No outreach yet` when null.
- **Block 2 (SIGNATURE — sides spectrum, `w-56 shrink-0 max-sm:w-full max-sm:order-3`)**:
  - A 6px bar: `flex h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]`.
    Total width ∝ `total_companies / maxCompanies` across ALL loaded rows
    (min 8% when >0), wrapped so the bar itself is the proportional element:
    outer fixed `w-56` track, inner `horizon-load` div at `width: pct%` containing
    flex segments per side with width = side companies / project companies,
    classes from `SIDE_BAR`. Sides with 0 companies render nothing.
  - Under it a mono microlabel `mt-1 text-[10px] tabular-nums text-muted-foreground`
    listing only non-zero sides: `Sell 71 · Buy 21`. If `total_companies === 0`:
    render the empty track + label "No companies yet".
  - `title` on the block: e.g. "Sell-side 71 companies · Buy-side 21 companies".
- **Block 3 (health, `shrink-0 text-right text-xs` hidden on `max-sm` → wraps)**:
  one line, mono numerals: `{overdue_count} late` (destructive, ONLY if >0) ·
  `{needs_initial_count} intro pending` (indigo, only if >0) ·
  `{Math.round(response_rate*100)}% replied` (muted; emerald when ≥ 30%? NO —
  keep muted always; color only encodes state semantics, not judgment).
  If everything is 0 and no companies: single muted "—".
- **Block 4 (team + actions, `ml-auto flex shrink-0 items-center gap-3`)**:
  - Team initials: up to 3 circles `flex h-6 w-6 items-center justify-center
    rounded-full border border-border bg-muted text-[10px] font-semibold` with
    initials (first letters of first+last word of full name), overlapping
    `-space-x-1.5`, `title={team.join(", ")}`; `+N` mono text when more. Hidden
    `sm:flex hidden`. Nothing when team empty.
  - **⋮ menu** (DropdownMenu, ghost h-8 w-8, `opacity-0 group-hover:opacity-100
    focus-visible:opacity-100` on lg, always visible below lg — Master's RowMenu
    pattern; `onClick={(e)=>e.stopPropagation()}` on the trigger wrapper):
    - "Open project" (Link)
    - "Add engagement" → opens `MandateDialog` with `projectId={id}`
      `defaultClientName={client_name}` (controlled: keep a `useState<number|null>`
      of "dialog open for project id" at page level, render one dialog; MandateDialog
      supports `trigger` only — it manages its own open state via the trigger span,
      so simplest is to render `<MandateDialog projectId=… defaultClientName=…
      trigger={<DropdownMenuItem …>}` — CAREFUL: dropdown items unmount on close.
      Safest: page-level state `addEngagementFor: Project | null`; when set, render
      MandateDialog **with a hidden auto-click trigger**… NO — cleanest: extend
      `MandateDialog` with optional controlled `open`/`onOpenChange` props exactly
      like `LogOutreachDialog`/`ContactDialog` already do (backward compatible,
      established pattern). Do that.)
    - Partner only: separator + "Archive"/"Restore" (window.confirm like today,
      then `useArchiveProject`).
  - Chevron `<ChevronRight className="h-4 w-4 text-muted-foreground/50">`.

### Ordering (no control — encodes attention honestly)
`[...items].sort((a,b) => (b.overdue_count??0)-(a.overdue_count??0)
|| (b.last_activity??"") > (a.last_activity??"") ? … : … || a.name.localeCompare(b.name))`
— i.e. late desc, then last_activity desc (string compare on ISO dates is fine,
nulls last), then name. Archived rows (when shown) sort after live rows.

### States
- **Loading**: 4 skeleton rows (`h-16 animate-pulse rounded-md bg-muted` inside the
  container, or reuse `TableSkeleton cols={2} rows={4}`).
- **Error**: centered `AlertTriangle` + "Couldn't load projects." + "Try again"
  button calling `refetch()`.
- **Empty (no projects at all)**: centered in container — FolderOpen icon,
  "No projects on your desk yet.", sub "Create a project for a client — or a partner
  can assign you to one.", amber "New project" button.
- **Empty (search)**: "No projects match "{q}"." + "Clear search" text-button.
- **Create dialog** (rewrite in-file `CreateProjectDialog`): fields Project name +
  Client name; MICRO-UX: client auto-mirrors name while the client field is
  untouched (track `clientTouched` bool; `onChange` of name also sets client when
  !clientTouched). Submit → toast "Project created" → `router.push(/projects/${id})`
  (the deal room's empty state invites the first engagement — the one obvious next
  step). Buttons: Cancel ghost, Create amber (`disabled={isPending}`, "Creating…").
- **fmtDate helper**: `"14 Jul"` style (copy from Schedule: split ISO, MONTH array).

### Delete from the old page
`OverviewChip`, `useCounter` import, `DataTable` usage, `ArchiveButton` (its function
moves into the ⋮ menu), the standalone "Show archived" row (moves into toolbar).

---

## 4. Deal room — REWRITE `frontend/app/(app)/projects/[id]/page.tsx`

**Identity: the client's war room — masthead, the sides (books), and the working
book itself. No hallway: the grid lives here.**

### Data
```ts
const { id } = use(params);              // projectId
const searchParams = useSearchParams();  // ?book=N
const { data: project, isLoading, error } = useProject(projectId);
const allEngagements = useMemo(() => [
  ...(project?.engagements.SELL_SIDE ?? []),
  ...(project?.engagements.BUY_SIDE ?? []),
  ...(project?.engagements.CAPITAL_RAISE ?? []),
], [project]);  // preserve type grouping order: sell → buy → raise
```
- Selected book id: `const [book, setBook] = useState<number>(() => Number(searchParams.get("book")) || 0)`.
  After `project` loads, if `book` is 0 or not in `allEngagements`, default to: first
  engagement with `overdue_count > 0`, else first engagement. Sync selection to URL
  with `window.history.replaceState(null, "", `/projects/${projectId}?book=${id}`)`
  (replaceState, not router.push — no nav spam).
- For the selected book reuse the OLD grid page's data wiring verbatim:
  `useMandate(book)` (exchange rate, type, MandateDetail for edit dialog),
  `useSourcingLayers(book)`, `useCategories()`,
  `useCompanies(book > 0 ? { mandate_id: book, page_size: 200, sort: "company_name" } : {})`.

### Layout (top → bottom)
1. **Back + actions row**: ghost "← Projects" `<Link href="/projects">` (keep the
   `group-hover:-translate-x-0.5` arrow nudge). Right: amber **Add engagement**
   (`MandateDialog projectId defaultClientName` — ALL roles) and, PARTNER ONLY, a
   ⋯ DropdownMenu: "Edit project" (the existing `EditProjectDialog` — keep that
   component, restyle nothing), "Archive"/"Restore" (existing confirm + mutation,
   `router.push("/projects")` after archive).
2. **Masthead (unboxed letterhead — DELETE the `project-hero` box)**:
   - Eyebrow (only when `client_name !== name`): `text-xs font-semibold uppercase
     tracking-widest text-muted-foreground` → `{client_name}`.
   - `<h1>` name: DISPLAY font `text-3xl sm:text-4xl font-semibold tracking-tight`
     (letterSpacing "-0.02em") + inline "Archived" muted chip when archived.
   - Vitals sentence `mt-2 text-sm text-muted-foreground`, mono numerals:
     `{E} engagement(s) · {N} companies · {R}% replied` + (if >0)
     ` · <span class=text-destructive font-medium>{X} late</span>` + (if >0)
     ` · <span class=text-indigo-400/90>{Y} intro pending</span>` +
     (if headline.last_activity) ` · Last activity {fmtDate}`.
   - Right side of masthead (flex justify-between): **team initials** — union of all
     engagement `analysts` (dedupe by id), same circle style as list page, max 4 + "+N",
     `title` = names, with a tiny eyebrow label "Team" above
     (`text-[9px] uppercase tracking-[0.1em] text-muted-foreground`). Omit when empty.
3. **Book rail** (the signature instrument — replaces the 5 StatCards AND the old
   EngagementCard sections): horizontal `flex items-stretch gap-0.5 overflow-x-auto
   rounded-xl border border-border/70 bg-muted/40 p-1` (Horizon rail chrome),
   `role="tablist"` `aria-label="Engagement books"`.
   Each cell = `<button role="tab" aria-selected>` `flex min-w-[190px] max-w-[260px]
   flex-1 flex-col gap-1 rounded-md px-3 py-2 text-left outline-none transition-colors
   focus-visible:ring-2 focus-visible:ring-ring` — active:
   `bg-card shadow-sm ring-1 ring-border`, inactive: `hover:bg-card/60`.
   Cell contents:
   - Line 1: side chip (DEAL_TYPE_SHORT + DEAL_TYPE_STYLE, `rounded px-1.5 py-px
     text-[11px] font-medium`) + engagement STATUS when not ACTIVE (dot+label:
     "on hold" amber / "closed" muted / "terminated" red, `text-[11px]`).
   - Line 2: engagement name, `truncate text-[13px] font-semibold tracking-tight`
     (`title` = full name).
   - Line 3 (mono, `text-[11px] tabular-nums`): `{total} companies` +
     ` · {late} late` (destructive, if >0) + ` · {new} new` (indigo, if >0).
   - Line 4 — **state-segmented underbar**: track `h-[3px] w-full overflow-hidden
     rounded-full bg-foreground/[0.06]`; inner `horizon-load` div with
     `width = max(8, total/maxTotal*100)%` (maxTotal across the rail; 0 → width 0)
     containing flex segments (order: late destructive / intro-pending indigo-500/80 /
     replied emerald-500/80 / cold muted-foreground/25 / remainder foreground/25),
     each `width = count/total*100%`. Stagger `--load-delay` per cell (i*40ms).
   Keyboard: rail buttons are tabbable; ←/→ within the rail move selection
   (optional; if added, use roving tabIndex).
4. **Book toolbar** (for the SELECTED book; one flex-wrap row):
   - Left: search input (`h-9`, w-44 focus:w-60, icon, clear ✕ when set, placeholder
     "Search this book…", `aria-label`), **Needs attention** toggle chip (existing
     logic: `(is_overdue && !is_cold) || AWAITING_INITIAL`; amber border/bg when on,
     shows `· {attentionCount}` mono), **Group** select (SELECT_CLS; options
     "Group: Band → Category" / "Category" / "Status" / "None"; keep state name
     `groupBy`, values `band-category|category|status|none`, default `band-category`).
   - Right: quiet link **Work queue →** `href={/schedule?deal=${book}}`
     (`text-xs font-medium text-primary hover:underline`, title "Open the outreach
     desk scoped to this engagement"), amber **Add company** (`AddCompanyDialog`
     with `mandateId={book} mandateName mandateType exchangeRate` exactly as the old
     grid page), and a ⋮ DropdownMenu for the engagement:
     - "Manage team" → TeamDialog (below) — PARTNER only
     - "Edit engagement" → `MandateDialog mandate={mandateDetail}` — PARTNER only
       (mandate comes from `useMandate(book)`; extend MandateDialog with controlled
       open as in §3, reuse here)
     - Analyst sees neither → hide ⋮ entirely for analysts.
   - Under the toolbar, a mono summary caption `text-xs text-muted-foreground`:
     unfiltered: `{total} companies · {pct}% replied · {late} late · {intro} intro
     pending` (from `data.summary` + `data.total`, same colors as everywhere);
     filtered: `{filtered.length} of {data.total} shown` + quiet "Clear filters"
     text-button.
5. **The book grid** — port the mechanics from the old
   `app/(app)/projects/[id]/grid/page.tsx` (grouping code can be copied nearly
   verbatim: `orderedCategoryGroups`, `Band`/`SubGroup` interfaces, the `bands`
   useMemo incl. layer ordering + Unsorted + empty-band dropping, `groupHealth`,
   `needsAttention`, `cadenceTooltip`, collapse state per band/subgroup, inline
   AddCompanyDialog on band + subgroup headers with `defaultSourcingLayerId` /
   `defaultCategoryId`, `data-testid`s: `grid-table`, `grid-company-row`,
   `grid-search`, `group-by`, `inline-add-*`, `log-touch-*`). RESTYLE ONLY:
   - Container: `overflow-hidden rounded-xl border border-border/70 bg-card`
     (page scrolls naturally — NOT an inner overflow-auto pane).
   - `<thead>`: `sticky top-0 z-10 bg-card` row of `TH_CLS` cells. Band header rows
     `sticky top-[33px] z-[5]` (verify offset visually; old page used top-9).
   - **Columns (6)**: Company (th `w-full`, td `max-w-0` — the ONE flexible column) |
     Rev ₹Cr (`hidden xl:table-cell`, right-aligned, mono) | Status
     (`hidden md:table-cell`, dot+label) | Next touch (always visible,
     `whitespace-nowrap`) | Contact (`hidden lg:table-cell`, truncate span
     `max-w-[10rem]`, title=email, "—" when none) | actions (w fit).
     `const COLS = 6` for colSpans. Every non-Company cell `whitespace-nowrap`.
     **Do NOT use `table-fixed`** (breaks with responsive hidden columns — known
     Chrome gotcha).
   - Company cell: name `<Link href={/companies/${id}}>` `text-sm font-medium
     truncate block hover:text-primary` + sub-line `text-[11px] text-muted-foreground
     truncate`: `{hq}` and, when `flattened` (groupBy none/status),
     ` · {category_name}`.
   - Rev cell: `₹{Number(revenue_inr_cr).toLocaleString("en-IN")}` mono text-xs,
     "—" muted when null.
   - **Next touch cell** — Master's language exactly (mono text-xs):
     - AWAITING_INITIAL → `intro pending` (`text-indigo-500 dark:text-indigo-400`,
       title "Awaiting the first email — the clock hasn't started")
     - overdue (not cold) → `{|days|}d late` (`font-semibold text-destructive`,
       title "Was due {fmtDate(next_due_date)}")
     - due ≤7d → `today`/`{n}d · {fmtDate}` (`font-medium text-primary`)
     - active else → `{fmtDate(next_due_date)}` muted
     - cold → `cold` (`text-muted-foreground/50`, title "Follow-up cap reached after
       {cycle_number} cycle(s)")
     - stopped (replied/declined/bounced) → `—` muted/50, title "Cadence stopped".
   - Status cell: STATUS_META dot + label, `text-xs text-muted-foreground`.
   - **Row actions** (replaces bare "Log" button): while cadence runs
     (not cold, schedule_status ACTIVE or AWAITING_INITIAL): split control —
     primary outline `h-7 rounded-r-none text-xs font-normal` labeled
     `Send intro` (awaiting) / `Follow-up`, quiet-until-row-hover amber fill
     (classes in §1), wrapping `LogOutreachDialog companyId companyName
     defaultEventType={awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP"}` as trigger;
     plus `-ml-px h-7 w-6 rounded-l-none` ▾ DropdownMenu: "Mark replied"
     (Reply icon emerald, RESPONSE), "Mark bounced" (XCircle red, BOUNCE),
     separator, "Log call" (CALL), "Log meeting" (MEETING) — each sets a
     `quickType` state rendering a controlled `LogOutreachDialog … open
     onOpenChange trigger={null} key={quickType}` (Schedule's exact pattern).
     Stopped/cold rows: single ghost ⋮ → "Open dossier" (Link to company).
   - Band headers: keep sticky + collapse chevron + mono count pill + late chip
     (`{n} late` destructive) + intro-pending chip (indigo, header only) + inline
     Add button; band color = `boxShadow: inset 3px 0 0 0 {color}` with the OLD
     `BAND_COLORS` array; subgroup headers: indent pl-9, category color dot,
     name + mono count + late count, inline `+`.
   - Row base: `grid-row border-t border-border/40 hover:bg-muted/30` + `group`
     (needed for quiet-until-hover actions).
   - Delete: `Count`/`useCounter` count-ups, `StatusBadge`/`CadenceBadge` usage,
     the old summary strip (replaced by toolbar caption), the old top breadcrumb
     bar (masthead owns identity now).
### States (deal room)
- Page loading: masthead skeleton (h-8 w-56 + h-4 w-72) + rail skeleton
  (h-[72px] rounded-xl) + `TableSkeleton`.
- Error/not found: "Project not found." + `<Link href="/projects">` "← Back to
  projects" (NO dead end).
- **No engagements yet** (the post-create moment): centered invitation in a dashed
  rounded container: FolderOpen icon, "No engagements in this project yet.",
  sub "Open the first book — sell-side, buy-side, or a capital raise under
  {client_name}.", THREE quiet outline buttons "Sell-side" / "Buy-side" /
  "Capital raise" each opening MandateDialog with `defaultType` preset +
  `projectId` + `defaultClientName` (MandateDialog already accepts `defaultType`).
  Shown to ALL roles.
- Book grid loading: 5 pulse rows. Book grid error: AlertTriangle + "Couldn't load
  this book." + Retry (`refetch`).
- Book empty (data.total===0): "This book is empty." + "Add the first company"
  (AddCompanyDialog trigger) + quiet link "or discover targets in Sourcing →"
  (`/sourcing`).
- Filter/search empty: same copy pattern as old grid ("Nothing needs attention right
  now — no late or unstarted outreach." / `No companies match "{q}"` + clear).
- Respect existing `MandateDialog` edit flow for partner edit.

### TeamDialog (new, small component in the same file)
Dialog (max-w-md) "Team — {engagement name}". List current `assignments` from
`useMandate(book)` (full_name + role lowercase muted + remove ✕ per row calling
`useUnassignUser`, confirm not needed) and an assign row: select of
`useUsers()` minus already-assigned + amber "Assign" button (`useAssignUser`).
Toasts "Analyst assigned" / "Removed". Loading/pending states on buttons.
(This is the old `/mandates/[id]` AssignmentsCard, relocated + restyled quiet.)

---

## 5. Cross-page glue

1. **`frontend/app/(app)/projects/[id]/grid/page.tsx`** — replace the whole file with
   a tiny client redirect (deep links + old bookmarks keep working):
   ```tsx
   "use client";
   import { use, useEffect } from "react";
   import { useRouter, useSearchParams } from "next/navigation";
   export default function GridRedirect({ params }: { params: Promise<{ id: string }> }) {
     const { id } = use(params);
     const router = useRouter();
     const sp = useSearchParams();
     useEffect(() => {
       const mandate = sp.get("mandate_id");
       router.replace(`/projects/${id}${mandate ? `?book=${mandate}` : ""}`);
     }, [id, router, sp]);
     return null;
   }
   ```
2. **`frontend/app/(app)/analytics/projects/page.tsx`** — change the two links
   `/projects/${projectId}/grid?mandate_id=${eng.id}` → `/projects/${projectId}?book=${eng.id}`
   (label "Grid →" → "Book →").
3. **`frontend/app/(app)/schedule/page.tsx`** — in the existing mount effect that
   parses `window.location.search` for `email_connected` (search for that string),
   add BEFORE the cleanup block:
   ```ts
   const deal = sp.get("deal");
   if (deal) setMandateId(Number(deal) || 0);
   ```
   (Do NOT strip `deal` from the URL; do not touch anything else in this file —
   it is the locked reference design.)
4. **Delete legacy pages**: `frontend/app/(app)/mandates/page.tsx` and
   `frontend/app/(app)/mandates/[id]/page.tsx` (orphaned; grep first to confirm
   nothing imports them — last check showed zero references). Keep
   `tests/mandates.test.tsx` (pure functions, still green). Keep
   `components/features/stat-card.tsx` (still used by companies/dashboard).
5. **`components/features/mandate-dialog.tsx`** — add optional controlled props
   (backward compatible, same pattern as ContactDialog):
   ```ts
   open?: boolean; onOpenChange?: (o: boolean) => void;   // + trigger?: ReactNode|null
   ```
   Internally: `const [internalOpen, setInternalOpen] = useState(false);
   const isOpen = open ?? internalOpen; const setIsOpen = onOpenChange ?? setInternalOpen;`
   and render the trigger span only when `trigger !== null`.

---

## 6. Verification (run ALL of this; fix everything it surfaces)

Backend (from `upstream/backend`, use `./.venv/Scripts/python.exe`):
```
./.venv/Scripts/python.exe -m pytest -q          # full suite must pass
```

Frontend (from `upstream/frontend`):
```
npx tsc --noEmit
npx eslint app components hooks lib types tests
npm run build        # Next build must be green
npx vitest run       # 63+ tests must pass
```

Live screenshots (self-critique pass — REQUIRED, then revise at least once):
- `.env` points at Railway prod; for local run override per memory: backend
  `uvicorn app.main:app --reload` with `DATABASE_URL=sqlite+aiosqlite:///./upstream.db`
  (+ cookie settings), seed via `python -m app.seed.seed --reset`; frontend
  `npm run dev` on :3000 (often already running — check first; blank page =
  backend down).
- Playwright script must live INSIDE `frontend/` (ESM resolution). Log in as
  `partner@upstream.test` / `Passw0rd!` AND as an analyst (`analyst1@upstream.test` /
  `Passw0rd!` — verify seed prints exact emails) — the analyst view must be checked
  (create rights, hidden partner menus).
- App is dark-first; for light-mode shots CLICK the "Switch to light mode" topbar
  button (Playwright `colorScheme` does NOT flip it).
- The Next dev-tools badge (bottom-right) intercepts clicks — scope selectors.
- Shots to take: /projects dark + light + mobile (390px) + archived-on + search;
  deal room: default book, second book selected, needs-attention on, group=Status,
  empty project (create one via UI as analyst — also proves analyst create),
  book empty state, Manage team dialog (partner), mobile deal room.
- Critique against: information density, alignment, truncation (long names),
  dark/light contrast, focus rings visible, no layout shift from bars animating.

Manual flow checks:
- Analyst can: create project → land in deal room → add engagement (auto-assigned,
  visible) → add company → log touch from the book row → quick outcomes work.
- `?book=` deep link selects the right rail cell; old `/grid?mandate_id=` URL
  redirects correctly; "Work queue →" opens Schedule pre-scoped to the deal.
- Partner: archive/restore project, edit engagement, manage team (assign/unassign
  reflects in masthead + rail after invalidation — check §2 hook invalidation).
- Reduced motion: globals.css already zeroes animations; the `horizon-load` bars
  must not be invisible (they end at full width — verify).

## 7. Known gotchas (from hard-won memory — do not rediscover)

- `--font-display` (Cormorant) has old-style figures — NEVER set numerals in it;
  all counts/dates/percentages use `MONO`.
- base-ui DropdownMenu Positioner is z-50; keep any custom overlay at exactly z-50.
- `DropdownMenuItem render={<Link/>}` works (base-ui pattern used in Master).
- eslint `react-hooks/set-state-in-effect` forbids setState-in-effect patterns —
  the book default-selection effect must guard (only set when value actually
  changes); `react-hooks/refs` forbids reading refs during render.
- `table-fixed` + `hidden md:table-cell` is broken in Chrome — use auto layout,
  `w-full` th + `max-w-0` td on the one flexible column, `whitespace-nowrap`
  everywhere else, inner `span.block.max-w-[Nrem].truncate` for capped columns.
- A `min-w-0` flex child whose child has `max-w-full`+truncate can collapse to
  siblings' width — give it `grow basis-64`.
- Seed data: 4 projects / 6 mandates (Medanta is two-sided), analysts 1–4;
  most seeded contacts have NULL sentiment until touches go through the API.
- `lib/query-invalidation.ts` already busts projects/mandates on outreach writes —
  the book grid's log actions will refresh rollups automatically.

## 8. Definition of done
Every feature works (no decorative controls), responsive to 390px, visible focus
rings, honest data only (no fabricated signals), all commands in §6 green, live
screenshots reviewed and at least one revision pass applied, and the final
write-up delivered: cross-page map, audit table (keep/modify/redesign per feature),
placement changes, additions/removals with analyst-value reasons, token system +
signature ("book bar" family), and what changed after self-critique.
