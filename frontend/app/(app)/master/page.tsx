"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUpRight,
  Bookmark,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Globe,
  MoreHorizontal,
  PhoneCall,
  Reply,
  Search,
  SlidersHorizontal,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { useCompanyProfiles, type ProfileFilters, type ProfileSort } from "@/hooks/use-profiles";
import { useMyBook } from "@/hooks/use-my-book";
import { useCategories } from "@/hooks/use-categories";
import { useMandates } from "@/hooks/use-mandates";
import { useArchiveCompany, useUnarchiveCompany } from "@/hooks/use-companies";
import { useAuth } from "@/hooks/use-auth";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { AddCompanyDialog } from "@/components/features/add-company";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { TaskDialog } from "@/components/features/task-dialog";
import { PipelineBoard, type BoardRow } from "@/components/features/pipeline-board";
import { EmptyState } from "@/components/features/empty-state";
import { ColumnToggle, type ToggleableColumn } from "@/components/features/column-toggle";
import { BulkBar } from "@/components/features/bulk-bar";
import { useConfirm } from "@/components/features/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { enumParam, intParam, stringParam, type ParamSpec } from "@/lib/table-url-state";
import { allSelected, pruneSelection, toggle, toggleMany } from "@/lib/selection";
import { toastUndo } from "@/lib/undo-toast";
import {
  DEAL_TYPE_LABEL,
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  DUE_TOKEN,
  LATE_TOKEN,
  MONO,
  PAGE_TITLE,
  PAGE_TITLE_STYLE,
  SELECT_CLS,
  STATUS_META,
  TH_CLS,
  TH_STICKY,
} from "@/lib/design";
import { cn } from "@/lib/utils";
import type { Company, CompanyProfile, MandateType, ProfilePlacement } from "@/types";

const PAGE_SIZE = 50;

// Deal-type and status vocabularies are shared with the Outreach desk, Sourcing
// and Projects — see lib/design.ts. Aliased here to the names this page already
// reads by.
// Widened to Record<string, string>: these are indexed by the raw filter value
// off the URL, which is a plain string until it round-trips through the API.
const ENGAGEMENT_SHORT: Record<string, string> = DEAL_TYPE_SHORT;
const ENGAGEMENT_LABEL: Record<string, string> = DEAL_TYPE_LABEL;
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.label]),
);

const SORT_LABEL: Record<ProfileSort, string> = {
  name: "Name",
  engagements: "Most worked",
  revenue: "Revenue",
  headcount: "Headcount",
};

type Tab = "my-book" | "firm-wide" | "board";

interface SavedView {
  name: string;
  f: {
    q?: string;
    category_id?: number;
    engagement_type?: string;
    status?: string;
    min_engagements?: number;
    sort?: ProfileSort;
  };
}
const VIEWS_KEY = "master-firm-views-v1";
const TAB_KEY = "master-active-tab";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTH[m - 1]}` : iso;
}

// ── Relationship state — one vocabulary for cells, lens, and the next-touch column ─
// Ink language shared with the rest of the app: late is the only solid-black cell, an
// intro that has not gone out is hollow, and everything else steps down the ladder by
// how much it asks of you — a reply waiting on a next step, then due soon, then a
// cadence running quietly, then a book that has closed.

type BookState = "overdue" | "awaiting" | "due_soon" | "active" | "responded" | "cold";

const STATE_META: Record<BookState, { label: string; cell: string; running: boolean }> = {
  overdue: { label: "Late", cell: "bg-danger", running: true },
  awaiting: { label: "Intro pending", cell: "ink-hollow", running: true },
  due_soon: { label: "Due soon", cell: "bg-warning", running: true },
  active: { label: "In cadence", cell: "bg-ink-400", running: true },
  responded: { label: "Replied", cell: "bg-success", running: false },
  cold: { label: "Cold / closed", cell: "bg-ink-200", running: false },
};

function companyState(c: Company): BookState {
  // INTERESTED does not stop the cadence (only RESPONDED/DECLINED/BOUNCED do),
  // so an interested company can still be late.
  if (c.is_overdue) return "overdue";
  if (c.schedule_status === "AWAITING_INITIAL") return "awaiting";
  if (c.schedule_status === "ACTIVE" && c.days_remaining != null && c.days_remaining <= 7) return "due_soon";
  if (c.status === "RESPONDED" || c.status === "INTERESTED") return "responded";
  if (c.is_cold || c.status === "DECLINED" || c.status === "BOUNCED") return "cold";
  return "active";
}

/** Active = the cadence clock is running; Stopped = replied, declined, bounced, or cold. */
function isActive(c: Company): boolean {
  return STATE_META[companyState(c)].running;
}

function matchesLens(c: Company, lens: "all" | "active" | "stopped"): boolean {
  return lens === "all" || (lens === "active" ? isActive(c) : !isActive(c));
}

// ── Coverage cells — the register's signature ───────────────────────────────────
// One small square per company on each project's ledger row: the project is
// literally countable. Colour = relationship state; every cell is a real link
// into that company's dossier (title tells you who before you click). Discrete
// records, deliberately unlike the Outreach desk's continuous load bars.

const CELL_CAP = 40;

function CoverageCells({ items }: { items: Company[] }) {
  const shown = items.slice(0, CELL_CAP);
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-[3px]">
      {shown.map((c) => {
        const s = companyState(c);
        return (
          <Link
            key={c.id}
            href={`/companies/${c.id}`}
            title={`${c.company_name} — ${STATE_META[s].label}`}
            aria-label={`${c.company_name} — ${STATE_META[s].label}`}
            className={cn(
              "h-[7px] w-[7px] shrink-0 rounded-[2px] outline-none transition-transform hover:scale-150 focus-visible:scale-150 focus-visible:ring-2 focus-visible:ring-ring",
              STATE_META[s].cell,
            )}
          />
        );
      })}
      {items.length > CELL_CAP && (
        <span className="ml-1 text-[10px] tabular-nums text-muted-foreground" style={MONO}>
          +{items.length - CELL_CAP}
        </span>
      )}
    </span>
  );
}

// ── Next-touch cell — the cadence, spoken in register language ──────────────────

function NextTouch({ c }: { c: Company }) {
  const s = companyState(c);
  const days = c.days_remaining;
  if (s === "awaiting")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground" title="Awaiting the first email — the clock hasn't started">
        <span className="hb hb-dashed" aria-hidden />
        Intro pending
      </span>
    );
  if (s === "overdue")
    return (
      <span className={LATE_TOKEN} style={MONO} title={c.next_due_date ? `Was due ${fmtDate(c.next_due_date)}` : undefined}>
        {Math.abs(days ?? 0)}d late
      </span>
    );
  if (s === "due_soon")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs" style={MONO} title={days === 0 ? "Due today" : `Due in ${days} days`}>
        <span className={DUE_TOKEN}>{days === 0 ? "Today" : `${days}d`}</span>
        <span className="text-muted-foreground">{fmtDate(c.next_due_date)}</span>
      </span>
    );
  if (s === "active")
    return (
      <span className="text-xs text-muted-foreground" style={MONO} title={days != null ? `Due in ${days} days` : undefined}>
        {c.next_due_date ? fmtDate(c.next_due_date) : "—"}
      </span>
    );
  return (
    <span
      className="text-xs text-muted-foreground"
      style={MONO}
      title={s === "responded" ? "Cadence stopped — they replied" : "Cadence stopped"}
    >
      —
    </span>
  );
}

// ── Row menu — every touch action, one quiet control ────────────────────────────
// The register is for reading; acting lives on Schedule. One compact menu keeps
// "log it while you're looking at it" possible without turning rows into a queue.

function RowMenu({ c }: { c: Company }) {
  const awaiting = c.schedule_status === "AWAITING_INITIAL";
  const running = isActive(c);
  const [quickType, setQuickType] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground opacity-60 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 lg:opacity-0"
              aria-label={`Actions for ${c.company_name}`}
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {running && (
            <>
              <DropdownMenuItem onClick={() => setQuickType(awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP")}>
                <Reply className="h-4 w-4 text-primary-ink" aria-hidden />
                {awaiting ? "Send intro" : "Log follow-up"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickType("RESPONSE")}>
                <Reply className="h-4 w-4 text-foreground" aria-hidden /> Mark replied
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickType("BOUNCE")}>
                <XCircle className="h-4 w-4 text-destructive-ink" aria-hidden /> Mark bounced
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setQuickType("CALL")}>
                <PhoneCall className="h-4 w-4 text-muted-foreground" aria-hidden /> Log call
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuickType("MEETING")}>
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> Log meeting
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setTaskOpen(true)}>
            <CheckSquare className="h-4 w-4 text-muted-foreground" aria-hidden /> Add task
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/companies/${c.id}`} />}>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden /> Open dossier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Pre-attached to this company — the server derives the mandate and project. */}
      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaults={{ title: "", company_id: c.id }}
      />
      {quickType !== null && (
        <LogOutreachDialog
          key={quickType}
          companyId={c.id}
          companyName={c.company_name}
          defaultEventType={quickType}
          open
          onOpenChange={(o) => !o && setQuickType(null)}
          trigger={null}
        />
      )}
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function MasterListPage() {
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";
  const [tab, setTab] = useState<Tab>("my-book");
  const inited = useRef(false);

  // Resolve the initial view once (after auth): URL (?view=) → saved preference → role default.
  useEffect(() => {
    if (inited.current || !user) return;
    inited.current = true;
    const isTab = (v: string | null): v is Tab =>
      v === "my-book" || v === "firm-wide" || v === "board";
    const fromUrl = new URLSearchParams(window.location.search).get("view");
    let pick: Tab | null = isTab(fromUrl) ? fromUrl : null;
    if (!pick) {
      try {
        const s = localStorage.getItem(TAB_KEY);
        if (isTab(s)) pick = s;
      } catch {}
    }
    setTab(pick ?? (isPartner ? "firm-wide" : "my-book"));
  }, [user, isPartner]);

  // Remembered (localStorage) and shareable (URL), without a navigation.
  const selectTab = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
    const params = new URLSearchParams(window.location.search);
    params.set("view", t);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Command line ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
            Master List
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every company the firm works — your book, its pipeline, and the shared database.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Master list view"
            className="inline-flex h-8 w-fit items-center gap-0.5 rounded-md bg-muted p-0.5 text-muted-foreground ring-1 ring-inset ring-border"
          >
            {(
              [
                { id: "my-book", label: "My book" },
                { id: "board", label: "Pipeline board" },
                { id: "firm-wide", label: "Firm database" },
              ] as const
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls="master-panel"
                  onClick={() => selectTab(t.id)}
                  className={cn(
                    "inline-flex h-full items-center rounded-[5px] px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <AddCompanyDialog trigger={<Button size="sm">New company</Button>} />
        </div>
      </div>

      <div role="tabpanel" id="master-panel" aria-labelledby={`tab-${tab}`}>
        {tab === "my-book" ? (
          <MyBookView />
        ) : tab === "board" ? (
          <BoardView />
        ) : (
          <FirmWideView isPartner={isPartner} />
        )}
      </div>
    </div>
  );
}

// ── My book — the analyst's register across every project ──────────────────────

interface BookGroup {
  key: string;
  project_id: number | null;
  project_name: string | null;
  client_name: string | null;
  companies: Company[];
}

type Lens = "all" | "active" | "stopped";
type BookSort = "registry" | "name" | "status" | "next";
type BookRow = { c: Company; projectKey: string; projectName: string };

const BOOK_SORT_LABEL: Record<BookSort, string> = {
  registry: "Registry (by project)",
  name: "Name",
  status: "Status",
  next: "Next touch",
};

/** Urgency ordering for the "Next touch" sort: latest first, then due-soonest. */
function nextTouchRank(c: Company): number {
  const s = companyState(c);
  if (s === "overdue") return -10000 + (c.days_remaining ?? 0); // most late first
  if (s === "due_soon" || s === "active") return c.days_remaining ?? 5000;
  if (s === "awaiting") return 6000;
  return 9000; // stopped last
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── URL-persisted state + toggleable columns (P2 DataTable pattern) ─────────────
// The my-book view's filters live in the URL (shareable, reload-stable), and the
// four secondary columns can be hidden per-analyst (persisted in localStorage).

const MY_BOOK_SPEC = {
  q: stringParam(""),
  scope: stringParam("all"),
  lens: enumParam(["all", "active", "stopped"] as const, "all"),
  sort: enumParam(["registry", "name", "status", "next"] as const, "registry"),
} satisfies ParamSpec;

const MY_BOOK_COLUMNS: ToggleableColumn[] = [
  { key: "company", label: "Company", locked: true },
  { key: "category", label: "Category" },
  { key: "hq", label: "HQ" },
  { key: "revenue", label: "Rev ₹Cr" },
  { key: "status", label: "Status", locked: true },
  { key: "next", label: "Next touch" },
];

function MyBookView() {
  const { data, isLoading, isError, refetch } = useMyBook();
  const { data: mandates } = useMandates();
  const archiveCompany = useArchiveCompany();
  const unarchiveCompany = useUnarchiveCompany();
  const confirm = useConfirm();

  const [urlState, patchUrl] = useTableUrlState(MY_BOOK_SPEC);
  const { q: search, scope, lens, sort } = urlState;
  const setScope = (v: string) => patchUrl({ scope: v });
  const setLens = (v: Lens) => patchUrl({ lens: v });
  const setSort = (v: BookSort) => patchUrl({ sort: v });
  const setSearch = (v: string) => patchUrl({ q: v });

  const cols = useColumnVisibility("master-mybook-cols", MY_BOOK_COLUMNS.map((c) => c.key));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const q = search.trim().toLowerCase();

  const dealTypes = useMemo(() => {
    const m = new Map<number, MandateType>();
    for (const d of mandates?.items ?? []) m.set(d.id, d.type);
    return m;
  }, [mandates]);

  const groups = useMemo<BookGroup[]>(() => {
    if (!data?.groups) return [];
    return data.groups
      .map((g) => ({
        key: String(g.project_id ?? g.project_name ?? "unassigned"),
        project_id: g.project_id,
        project_name: g.project_name,
        client_name: g.client_name,
        companies: g.companies,
      }))
      .sort((a, b) => (a.project_name ?? "Unassigned").localeCompare(b.project_name ?? "Unassigned"));
  }, [data]);

  const scopedGroups = useMemo(
    () => (scope === "all" ? groups : groups.filter((g) => g.key === scope)),
    [groups, scope],
  );

  // Lens counts are computed on the scoped set, so the control always tells the
  // truth about what's in front of you.
  const lensCounts = useMemo(() => {
    let active = 0;
    let stopped = 0;
    for (const g of scopedGroups)
      for (const c of g.companies) {
        if (isActive(c)) active += 1;
        else stopped += 1;
      }
    return { all: active + stopped, active, stopped };
  }, [scopedGroups]);

  // Search is a lookup across the WHOLE book (scope and lens don't hide answers).
  const searchRows = useMemo<BookRow[]>(() => {
    if (!q) return [];
    const hits: BookRow[] = [];
    for (const g of groups) {
      const pname = (g.project_name ?? "Unassigned").toLowerCase();
      for (const c of g.companies)
        if (
          c.company_name.toLowerCase().includes(q) ||
          (c.category_name ?? "").toLowerCase().includes(q) ||
          (c.hq ?? "").toLowerCase().includes(q) ||
          pname.includes(q)
        )
          hits.push({ c, projectKey: g.key, projectName: g.project_name ?? "Unassigned" });
    }
    return hits.sort((a, b) => a.c.company_name.localeCompare(b.c.company_name));
  }, [q, groups]);

  // Grouped registry (default) — A→Z inside each project, ledger row per project.
  const registryGroups = useMemo(() => {
    return scopedGroups
      .map((g) => ({
        ...g,
        rows: g.companies
          .filter((c) => matchesLens(c, lens))
          .sort((a, b) => a.company_name.localeCompare(b.company_name)),
      }))
      .filter((g) => g.rows.length > 0);
  }, [scopedGroups, lens]);

  // Flat table when a global sort is chosen — sorting across projects needs one list.
  const flatRows = useMemo<BookRow[]>(() => {
    if (sort === "registry") return [];
    const rows: BookRow[] = [];
    for (const g of scopedGroups)
      for (const c of g.companies)
        if (matchesLens(c, lens)) rows.push({ c, projectKey: g.key, projectName: g.project_name ?? "Unassigned" });
    const cmp: Record<Exclude<BookSort, "registry">, (a: BookRow, b: BookRow) => number> = {
      name: (a, b) => a.c.company_name.localeCompare(b.c.company_name),
      status: (a, b) =>
        (STATUS_LABEL[a.c.status] ?? "").localeCompare(STATUS_LABEL[b.c.status] ?? "") ||
        a.c.company_name.localeCompare(b.c.company_name),
      next: (a, b) => nextTouchRank(a.c) - nextTouchRank(b.c) || a.c.company_name.localeCompare(b.c.company_name),
    };
    return rows.sort(cmp[sort]);
  }, [scopedGroups, lens, sort]);

  const totalCompanies = groups.reduce((n, g) => n + g.companies.length, 0);
  const lateTotal = useMemo(
    () => groups.reduce((n, g) => n + g.companies.filter((c) => companyState(c) === "overdue").length, 0),
    [groups],
  );

  // ── Display set + selection (P2: bulk actions over the rows on screen) ─────────
  // The Project column appears once the register is flattened (a global sort) or a
  // search spans projects. The "displayed" rows are exactly what's rendered, so
  // select-all, CSV export, and selection-pruning all agree with the eye.
  const showProjectCol = q !== "" || sort !== "registry";
  const displayedRows: BookRow[] = q
    ? searchRows
    : sort === "registry"
      ? registryGroups.flatMap((g) =>
          g.rows.map((c) => ({ c, projectKey: g.key, projectName: g.project_name ?? "Unassigned" })),
        )
      : flatRows;
  const displayedIds = displayedRows.map((r) => r.c.id);
  const displayedKey = displayedIds.join(",");

  // When the filter/search set changes, drop any selection that scrolled out of view
  // so the bulk-bar count never lies about what's still selectable.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((prev) => pruneSelection(prev, displayedIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedKey]);

  const allById = useMemo(() => {
    const m = new Map<number, BookRow>();
    for (const g of groups)
      for (const c of g.companies)
        m.set(c.id, { c, projectKey: g.key, projectName: g.project_name ?? "Unassigned" });
    return m;
  }, [groups]);

  const toggleRow = (id: number) => setSelected((p) => toggle(p, id));
  const clearSelection = () => setSelected(new Set());
  const allDisplayedSelected = allSelected(selected, displayedIds);
  const selectedRows = [...selected]
    .map((id) => allById.get(id))
    .filter((r): r is BookRow => !!r);

  // Column count for the many colSpan cells (ledger rows, search banner, empties).
  const colCount =
    2 + // select + company (both always present)
    (showProjectCol ? 1 : 0) +
    (cols.isVisible("category") ? 1 : 0) +
    (cols.isVisible("hq") ? 1 : 0) +
    (cols.isVisible("revenue") ? 1 : 0) +
    1 + // status
    (cols.isVisible("next") ? 1 : 0) +
    1; // actions

  const bulkArchive = async () => {
    if (!selectedRows.length) return;
    const n = selectedRows.length;
    const noun = n === 1 ? "company" : "companies";
    const ids = selectedRows.map((r) => r.c.id);
    const ok = await confirm({
      title: `Archive ${n} ${noun}?`,
      description:
        "They drop out of the book and the schedule. Nothing is destroyed — restore from each dossier, or undo straight after.",
      confirmLabel: `Archive ${n}`,
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => archiveCompany.mutateAsync(id)));
      toastUndo(`Archived ${n} ${noun}`, async () => {
        await Promise.all(ids.map((id) => unarchiveCompany.mutateAsync(id)));
      });
      setSelected(new Set());
    } catch {
      toast.error("Couldn't archive every company — some may remain.");
    }
  };

  const toggleCollapse = (k: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // Excel-ready CSV for an arbitrary set of book rows (used by both the WYSIWYG
  // export and the "export selected" bulk action).
  const downloadRows = (rows: BookRow[], filename: string) => {
    const header = [
      "Company", "Project", "Deal type", "Category", "HQ", "Status", "Cadence",
      "Next due", "Days remaining", "Revenue ₹Cr", "Headcount", "Website",
    ];
    const lines = [header.join(",")];
    for (const { c, projectName } of rows) {
      const dt = dealTypes.get(c.mandate_id);
      lines.push(
        [
          csvEscape(c.company_name),
          csvEscape(projectName),
          csvEscape(dt ? ENGAGEMENT_LABEL[dt] : ""),
          csvEscape(c.category_name),
          csvEscape(c.hq),
          csvEscape(STATUS_LABEL[c.status] ?? c.status),
          csvEscape(STATE_META[companyState(c)].label),
          csvEscape(c.next_due_date),
          csvEscape(c.days_remaining),
          csvEscape(c.revenue_inr_cr),
          csvEscape(c.headcount),
          csvEscape(c.website),
        ].join(","),
      );
    }
    // Leading BOM so Excel opens the file as UTF-8.
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = () => new Date().toISOString().slice(0, 10);
  // WYSIWYG export — exactly the rows currently on screen.
  const exportCsv = () => downloadRows(displayedRows, `my-book-${today()}.csv`);
  const exportSelected = () => downloadRows(selectedRows, `my-book-selection-${today()}.csv`);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
        <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />
        <p className="text-sm font-medium">Couldn&rsquo;t load your book.</p>
        <button onClick={() => refetch()} className="text-xs font-medium text-primary-ink hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-5 w-80 animate-pulse rounded bg-ink-100" />
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="h-9 border-b border-border bg-muted/20" />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="flex items-center gap-6 border-b border-border px-4 py-2.5 last:border-0">
              <div className="h-4 w-1/4 animate-pulse rounded bg-ink-100" />
              <div className="hidden h-3 w-1/6 animate-pulse rounded bg-ink-100 sm:block" />
              <div className="ml-auto h-3 w-24 animate-pulse rounded bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!groups.length) {
    return (
      <EmptyState
        icon={Building2}
        title="Your book is empty"
        description="Push companies into your engagements from the Sourcing workspace, or add one directly."
        action={
          <Link href="/sourcing" className="text-sm font-medium text-primary-ink hover:underline">
            Open Sourcing
          </Link>
        }
      />
    );
  }

  const bodyRows = (rows: BookRow[]) =>
    rows.map(({ c, projectName }) => (
      <RegistryRow
        key={c.id}
        c={c}
        dealType={dealTypes.get(c.mandate_id)}
        projectName={showProjectCol ? projectName : undefined}
        cols={cols}
        selected={selected.has(c.id)}
        anySelected={selected.size > 0}
        onToggleSelect={() => toggleRow(c.id)}
      />
    ));

  return (
    <div className="flex flex-col gap-4">
      {/* ── Vitals + tools ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground" style={MONO}>
            {totalCompanies}
          </span>{" "}
          {totalCompanies === 1 ? "company" : "companies"} ·{" "}
          <span className="font-semibold tabular-nums text-foreground" style={MONO}>
            {groups.length}
          </span>{" "}
          {groups.length === 1 ? "project" : "projects"}
          {lateTotal > 0 && (
            <>
              {" · "}
              <Link href="/schedule" className="rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" title="Open the outreach desk">
                <span className="font-semibold tabular-nums text-destructive-ink" style={MONO}>
                  {lateTotal}
                </span>{" "}
                <span className="text-destructive-ink">late → Schedule</span>
              </Link>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search your book"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your book…"
              className="h-9 w-40 pl-8 transition-[width] focus:w-60 sm:w-44"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={SELECT_CLS}
            aria-label="Scope to a project"
          >
            <option value="all">All projects</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.project_name ?? "Unassigned"}
              </option>
            ))}
          </select>
          {/* Active / stopped lens — "is the clock running?" */}
          <div role="group" aria-label="Cadence lens" className="inline-flex items-center rounded-lg bg-muted p-[3px] text-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "stopped", label: "Stopped" },
              ] as const
            ).map((l) => (
              <button
                key={l.id}
                aria-pressed={lens === l.id}
                onClick={() => setLens(l.id)}
                title={
                  l.id === "active"
                    ? "Cadence running — intro pending, due, or in cadence"
                    : l.id === "stopped"
                      ? "Cadence stopped — replied, declined, bounced, or cold"
                      : "Everything"
                }
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2.5 font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/50",
                  lens === l.id
                    ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
                <span className="tabular-nums text-muted-foreground" style={MONO}>
                  {lensCounts[l.id]}
                </span>
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as BookSort)} className={SELECT_CLS} aria-label="Sort">
            {(Object.keys(BOOK_SORT_LABEL) as BookSort[]).map((s) => (
              <option key={s} value={s}>
                Sort: {BOOK_SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <ColumnToggle
            columns={MY_BOOK_COLUMNS}
            isVisible={cols.isVisible}
            onToggle={cols.toggle}
            hiddenCount={cols.hiddenCount}
          />
          <Button variant="outline" onClick={exportCsv} title="Download the rows on screen as CSV">
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Export
          </Button>
        </div>
      </div>

      {/* ── The register ── */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="max-h-[calc(100vh-13rem)] overflow-auto">
          <table className="w-full min-w-[352px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className={cn(TH_STICKY, "w-9 px-2 py-2")}>
                  <button
                    onClick={() => setSelected((prev) => toggleMany(prev, displayedIds))}
                    aria-label={allDisplayedSelected ? "Clear selection" : "Select all shown"}
                    aria-pressed={allDisplayedSelected}
                    disabled={displayedIds.length === 0}
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors disabled:opacity-40",
                      allDisplayedSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:border-border-strong",
                    )}
                  >
                    {allDisplayedSelected && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                  </button>
                </th>
                <th scope="col" className={cn(TH_CLS, TH_STICKY, "w-full")}>
                  Company
                </th>
                {showProjectCol && (
                  <th scope="col" className={cn(TH_CLS, TH_STICKY, "hidden sm:table-cell")}>
                    Project
                  </th>
                )}
                {cols.isVisible("category") && (
                  <th scope="col" className={cn(TH_CLS, TH_STICKY, "hidden md:table-cell")}>
                    Category
                  </th>
                )}
                {cols.isVisible("hq") && (
                  <th scope="col" className={cn(TH_CLS, TH_STICKY, "hidden xl:table-cell")}>
                    HQ
                  </th>
                )}
                {cols.isVisible("revenue") && (
                  <th scope="col" className={cn(TH_CLS, TH_STICKY, "hidden text-right xl:table-cell")}>
                    Rev ₹Cr
                  </th>
                )}
                <th scope="col" className={cn(TH_CLS, TH_STICKY)}>
                  Status
                </th>
                {cols.isVisible("next") && (
                  <th scope="col" className={cn(TH_CLS, TH_STICKY, "hidden sm:table-cell")}>
                    Next touch
                  </th>
                )}
                <th scope="col" className={cn(TH_CLS, TH_STICKY, "w-11 px-1")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {q ? (
              <tbody>
                <tr className="border-b border-border bg-muted/30">
                  <td colSpan={colCount} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Search className="h-3.5 w-3.5 shrink-0 text-primary-ink" aria-hidden />
                      <span className="text-xs font-semibold">Search results</span>
                      <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground" style={MONO}>
                        {searchRows.length}
                      </span>
                      <span className="text-xs text-muted-foreground">· whole book, all projects</span>
                      <button
                        onClick={() => setSearch("")}
                        className="ml-auto rounded text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Clear search
                      </button>
                    </div>
                  </td>
                </tr>
                {searchRows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount}>
                      <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                        <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
                        <p className="text-sm font-medium">No companies match &ldquo;{search.trim()}&rdquo;.</p>
                        <p className="text-xs text-muted-foreground">Try a different name, project, category, or city.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bodyRows(searchRows)
                )}
              </tbody>
            ) : sort !== "registry" ? (
              <tbody>
                {flatRows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount}>
                      <EmptyLens lens={lens} onReset={() => setLens("all")} />
                    </td>
                  </tr>
                ) : (
                  bodyRows(flatRows)
                )}
              </tbody>
            ) : registryGroups.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={colCount}>
                    <EmptyLens lens={lens} onReset={() => setLens("all")} />
                  </td>
                </tr>
              </tbody>
            ) : (
              registryGroups.map((g) => {
                const isCollapsed = collapsed.has(g.key);
                const activeN = g.rows.filter((c) => isActive(c)).length;
                return (
                  <tbody key={g.key}>
                    {/* Project ledger row — the register's signature stratum */}
                    <tr className="border-b border-border bg-muted/30">
                      <td colSpan={colCount} className="px-2 py-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                          <button
                            onClick={() => toggleCollapse(g.key)}
                            aria-expanded={!isCollapsed}
                            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${g.project_name ?? "Unassigned"}`}
                            className="flex min-w-0 items-center gap-1.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ChevronDown
                              className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")}
                              aria-hidden
                            />
                            <span className="truncate text-xs font-semibold text-foreground">
                              {g.project_name ?? "Unassigned"}
                            </span>
                          </button>
                          {g.project_id != null && (
                            <Link
                              href={`/projects/${g.project_id}`}
                              className="rounded text-[11px] text-muted-foreground outline-none transition-colors hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring"
                              title="Open the project"
                            >
                              {g.client_name && g.client_name !== g.project_name ? g.client_name : "Open project"}
                              <ArrowUpRight className="ml-0.5 inline h-3 w-3" aria-hidden />
                            </Link>
                          )}
                          <span className="text-[11px] text-muted-foreground" style={MONO}>
                            <span className="font-semibold tabular-nums text-secondary-foreground">{g.rows.length}</span>
                            {lens === "all" && (
                              <>
                                {" · "}
                                <span className="tabular-nums">{activeN}</span> active
                              </>
                            )}
                          </span>
                          <span className="ml-auto hidden md:inline-flex">
                            <CoverageCells items={g.rows} />
                          </span>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed && bodyRows(g.rows.map((c) => ({ c, projectKey: g.key, projectName: g.project_name ?? "Unassigned" })))}
                  </tbody>
                );
              })
            )}
          </table>
        </div>
      </div>

      <BulkBar count={selected.size} noun={selected.size === 1 ? "company" : "companies"} onClear={clearSelection}>
        <Button size="sm" variant="outline" className="h-7" onClick={exportSelected}>
          <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> Export
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-destructive-ink hover:bg-destructive/10 hover:text-destructive-ink"
          onClick={bulkArchive}
          disabled={archiveCompany.isPending}
        >
          <Archive className="mr-1 h-3.5 w-3.5" aria-hidden /> Archive
        </Button>
      </BulkBar>
    </div>
  );
}

function EmptyLens({ lens, onReset }: { lens: Lens; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">
        {lens === "all" ? "No companies in this project yet." : lens === "active" ? "Nothing with a running cadence here." : "Nothing stopped here."}
      </p>
      {lens !== "all" && (
        <button onClick={onReset} className="text-xs font-medium text-primary-ink hover:underline">
          Show everything
        </button>
      )}
    </div>
  );
}

function RegistryRow({
  c,
  dealType,
  projectName,
  cols,
  selected,
  anySelected,
  onToggleSelect,
}: {
  c: Company;
  dealType?: MandateType;
  projectName?: string;
  cols: { isVisible: (key: string) => boolean };
  selected: boolean;
  anySelected: boolean;
  onToggleSelect: () => void;
}) {
  const status = STATUS_META[c.status] ?? STATUS_META.NOT_CONTACTED;
  return (
    <tr
      className={cn(
        "group border-b border-border transition-colors last:border-0 hover:bg-muted/40",
        selected && "bg-subtle hover:bg-subtle",
      )}
    >
      {/* Selection — appears on hover, or stays visible once any row is picked. */}
      <td className="w-9 px-2 py-2 align-middle">
        <button
          onClick={onToggleSelect}
          aria-label={selected ? `Deselect ${c.company_name}` : `Select ${c.company_name}`}
          aria-pressed={selected}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border transition-all focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : cn("border-input hover:border-border-strong", anySelected ? "opacity-70" : "opacity-0 group-hover:opacity-100"),
          )}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
        </button>
      </td>
      <td className="max-w-0 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/companies/${c.id}`}
            title={c.rationale ?? undefined}
            className="truncate rounded text-[13px] font-semibold tracking-tight text-foreground outline-none hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring"
          >
            {c.company_name}
          </Link>
          {dealType && (
            <span
              title={ENGAGEMENT_LABEL[dealType]}
              className={cn("hidden shrink-0 rounded px-1.5 py-px text-[10px] font-medium sm:inline", DEAL_TYPE_STYLE[dealType])}
            >
              {ENGAGEMENT_SHORT[dealType]}
            </span>
          )}
        </div>
      </td>
      {projectName && (
        <td className="hidden whitespace-nowrap px-3 py-2 sm:table-cell">
          <span className="block max-w-[10rem] truncate text-xs text-muted-foreground">{projectName}</span>
        </td>
      )}
      {cols.isVisible("category") && (
        <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
          <span className="block max-w-[9rem] truncate text-xs text-muted-foreground">{c.category_name ?? "—"}</span>
        </td>
      )}
      {cols.isVisible("hq") && (
        <td className="hidden whitespace-nowrap px-3 py-2 xl:table-cell">
          <span className="block max-w-[8rem] truncate text-xs text-muted-foreground">{c.hq ?? "—"}</span>
        </td>
      )}
      {cols.isVisible("revenue") && (
        <td className="hidden px-3 py-2 text-right xl:table-cell">
          <span className="text-xs tabular-nums text-secondary-foreground" style={MONO}>
            {c.revenue_inr_cr ? Number(c.revenue_inr_cr).toLocaleString() : "—"}
          </span>
        </td>
      )}
      <td className="whitespace-nowrap px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dot)} aria-hidden />
          {status.label}
        </span>
      </td>
      {cols.isVisible("next") && (
        <td className="hidden whitespace-nowrap px-3 py-2 sm:table-cell">
          <NextTouch c={c} />
        </td>
      )}
      <td className="px-1 py-1 text-right">
        <RowMenu c={c} />
      </td>
    </tr>
  );
}

// ── Pipeline board — the same book, read as a pipeline (P5) ────────────────────
// The register answers "what do I owe this project?"; the board answers "where does
// every name actually stand?". Same `useMyBook` data, no new endpoint — and no new
// status semantics either: a column is never written directly (see lib/pipeline-board).

const BOARD_SPEC = {
  q: stringParam(""),
  scope: stringParam("all"),
} satisfies ParamSpec;

function BoardView() {
  const { data, isLoading, isError, refetch } = useMyBook();
  const [urlState, patchUrl] = useTableUrlState(BOARD_SPEC);
  const { q: search, scope } = urlState;
  const q = search.trim().toLowerCase();

  const groups = useMemo(
    () =>
      (data?.groups ?? [])
        .map((g) => ({
          key: String(g.project_id ?? g.project_name ?? "unassigned"),
          name: g.project_name ?? "Unassigned",
          companies: g.companies,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  // Cards arrive attention-first, so the most urgent sits at the top of its column.
  const rows = useMemo<BoardRow[]>(() => {
    const out: BoardRow[] = [];
    for (const g of groups) {
      if (scope !== "all" && g.key !== scope) continue;
      for (const c of g.companies) {
        if (
          q &&
          !c.company_name.toLowerCase().includes(q) &&
          !(c.hq ?? "").toLowerCase().includes(q) &&
          !g.name.toLowerCase().includes(q)
        )
          continue;
        out.push({ c, projectName: g.name });
      }
    }
    return out.sort(
      (a, b) => nextTouchRank(a.c) - nextTouchRank(b.c) || a.c.company_name.localeCompare(b.c.company_name),
    );
  }, [groups, scope, q]);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
        <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden />
        <p className="text-sm font-medium">Couldn&rsquo;t load your book.</p>
        <button onClick={() => refetch()} className="text-xs font-medium text-primary-ink hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="flex w-[250px] shrink-0 flex-col gap-2 rounded-lg border bg-muted/20 p-2">
            <div className="h-8 animate-pulse rounded bg-ink-100" />
            <div className="h-16 animate-pulse rounded bg-ink-100" />
            <div className="h-16 animate-pulse rounded bg-ink-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <EmptyState
        icon={Building2}
        title="Your book is empty"
        description="Push companies into your engagements from the Sourcing workspace, or add one directly."
        action={
          <Link href="/sourcing" className="text-sm font-medium text-primary-ink hover:underline">
            Open Sourcing
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search the board"
            value={search}
            onChange={(e) => patchUrl({ q: e.target.value })}
            placeholder="Search the board…"
            className="h-9 w-40 pl-8 transition-[width] focus:w-60 sm:w-44"
          />
        </div>
        <select
          value={scope}
          onChange={(e) => patchUrl({ scope: e.target.value })}
          className={SELECT_CLS}
          aria-label="Scope to a project"
        >
          <option value="all">All projects</option>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name}
            </option>
          ))}
        </select>
        <Link
          href="/schedule"
          className="rounded text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          title="Work the queue on the outreach desk"
        >
          Working the queue? → Schedule
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nothing matches"
          description="No company in your book matches that search and project."
          action={
            <button
              onClick={() => patchUrl({ q: "", scope: "all" })}
              className="text-sm font-medium text-primary-ink hover:underline"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <PipelineBoard rows={rows} />
      )}
    </div>
  );
}

// ── Firm database — the deduped universe with relationship intelligence ─────────

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PlacementChip({ p }: { p: ProfilePlacement }) {
  return (
    <Link
      href={`/companies/${p.company_id}`}
      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      title={[
        p.client_name ?? p.mandate_name ?? "",
        p.engagement_type ? ENGAGEMENT_LABEL[p.engagement_type] : "",
        p.category_name ?? "",
        p.status ? STATUS_LABEL[p.status] ?? p.status : "",
        p.analyst_name ? `by ${p.analyst_name}` : "",
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <span className="font-medium text-secondary-foreground">{p.client_name ?? p.mandate_name}</span>
      {p.engagement_type && <span>· {ENGAGEMENT_SHORT[p.engagement_type] ?? p.engagement_type}</span>}
    </Link>
  );
}

/** Who has touched this company — the firm's relationship owners at a glance. */
function WorkedBy({ placements }: { placements: ProfilePlacement[] }) {
  const names = [...new Set(placements.map((p) => p.analyst_name).filter((n): n is string => !!n))];
  if (names.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = names.slice(0, 3);
  return (
    <span className="inline-flex items-center gap-1" title={names.join(", ")}>
      {shown.map((n) => (
        <span
          key={n}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-secondary-foreground ring-1 ring-border"
          style={MONO}
        >
          {initialsOf(n)}
        </span>
      ))}
      {names.length > 3 && (
        <span className="text-[10px] tabular-nums text-muted-foreground" style={MONO}>
          +{names.length - 3}
        </span>
      )}
    </span>
  );
}

function SortHeader({
  label,
  col,
  active,
  onClick,
  align = "left",
  className,
}: {
  label: string;
  col: ProfileSort;
  active: boolean;
  onClick: (c: ProfileSort) => void;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th scope="col" aria-sort={active ? "descending" : "none"} className={cn("px-3 py-2", className)}>
      <button
        onClick={() => onClick(col)}
        className={cn(
          "flex w-full items-center gap-1 rounded text-xs font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          active ? "text-foreground" : "text-muted-foreground",
          align === "right" && "justify-end",
        )}
      >
        {label}
        {active && <ArrowDown className="h-3 w-3 text-primary-ink" aria-hidden />}
      </button>
    </th>
  );
}

// Firm-database URL state. Param names match the deep-links Analytics already emits
// (?status, ?category_id, ?engagement_type), so drill-throughs keep landing here.
const FIRM_SPEC = {
  q: stringParam(""),
  category_id: intParam(0),
  engagement_type: stringParam(""),
  status: stringParam(""),
  min_engagements: intParam(0),
  sort: enumParam(["name", "engagements", "revenue", "headcount"] as const, "name"),
  page: intParam(1),
  by: enumParam(["0", "1"] as const, "0"), // group-by-analyst (partner)
} satisfies ParamSpec;

const FIRM_COLUMNS: ToggleableColumn[] = [
  { key: "company", label: "Company", locked: true },
  { key: "worked", label: "Worked by" },
  { key: "revenue", label: "Rev ₹Cr" },
  { key: "headcount", label: "Staff" },
  { key: "deals", label: "Deals" },
];

function FirmWideView({ isPartner }: { isPartner: boolean }) {
  const [urlState, patchUrl] = useTableUrlState(FIRM_SPEC);
  const {
    q,
    category_id: categoryId,
    engagement_type: engagementType,
    status: statusFilter,
    min_engagements: minEng,
    sort,
    page,
  } = urlState;
  const groupByAnalyst = urlState.by === "1";

  const [searchInput, setSearchInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const firmCols = useColumnVisibility("master-firm-cols", FIRM_COLUMNS.map((c) => c.key));
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [views, setViews] = useState<SavedView[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");

  const { data: categories } = useCategories();

  useEffect(() => {
    // Read persisted views only after mount: localStorage is unavailable during SSR,
    // and seeding initial state from it would cause a hydration mismatch.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViews(JSON.parse(localStorage.getItem(VIEWS_KEY) || "[]"));
    } catch {
      setViews([]);
    }
  }, []);

  // Seed the search box from the URL once (the state hook hydrates ?q post-mount).
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (u) setSearchInput(u);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => patchUrl({ q: searchInput.trim(), page: 1 }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const filters: ProfileFilters = {
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
    scope: isPartner ? "firm" : undefined,
    group_by: isPartner && groupByAnalyst ? "analyst" : undefined,
    category_id: categoryId || undefined,
    engagement_type: engagementType || undefined,
    status: statusFilter || undefined,
    min_engagements: minEng || undefined,
    sort,
  };
  const profiles = useCompanyProfiles(filters);

  const total = profiles.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const byAnalyst = (profiles.data as { by_analyst?: { analyst_name: string; profiles: number }[] })?.by_analyst;

  // Selection over the current page of profiles (bulk export).
  const pageItems = profiles.data?.items ?? [];
  const pageIds = pageItems.map((p) => p.id);
  const pageKey = pageIds.join(",");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((prev) => pruneSelection(prev, pageIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);
  const allPageSelected = allSelected(selected, pageIds);
  const toggleProfile = (id: number) => setSelected((p) => toggle(p, id));

  const setSortCol = (c: ProfileSort) => patchUrl({ sort: c, page: 1 });

  const activeFilters = [
    categoryId && {
      label: categories?.items.find((c) => c.id === categoryId)?.name ?? "Category",
      clear: () => patchUrl({ category_id: 0, page: 1 }),
    },
    engagementType && {
      label: ENGAGEMENT_LABEL[engagementType],
      clear: () => patchUrl({ engagement_type: "", page: 1 }),
    },
    statusFilter && {
      label: STATUS_LABEL[statusFilter],
      clear: () => patchUrl({ status: "", page: 1 }),
    },
    minEng && { label: `≥${minEng} engagements`, clear: () => patchUrl({ min_engagements: 0, page: 1 }) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const exportSelectedProfiles = () => {
    const chosen = pageItems.filter((p) => selected.has(p.id));
    const header = ["Company", "HQ", "Website", "Revenue ₹Cr", "Headcount", "Engagements", "Worked by"];
    const lines = [header.join(",")];
    for (const p of chosen) {
      const analysts = [...new Set(p.placements.map((pl) => pl.analyst_name).filter(Boolean))].join("; ");
      lines.push(
        [
          csvEscape(p.company_name),
          csvEscape(p.hq),
          csvEscape(p.website),
          csvEscape(p.revenue_inr_cr),
          csvEscape(p.headcount),
          csvEscape(p.engagement_count),
          csvEscape(analysts),
        ].join(","),
      );
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firm-database-selection-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const persistViews = (next: SavedView[]) => {
    setViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
  };
  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    persistViews([
      ...views.filter((v) => v.name !== name),
      { name, f: { q, category_id: categoryId, engagement_type: engagementType, status: statusFilter, min_engagements: minEng, sort } },
    ]);
    setViewName("");
    setSavingView(false);
  };
  const applyView = (v: SavedView) => {
    setSearchInput(v.f.q ?? "");
    patchUrl({
      q: v.f.q ?? "",
      category_id: v.f.category_id ?? 0,
      engagement_type: v.f.engagement_type ?? "",
      status: v.f.status ?? "",
      min_engagements: v.f.min_engagements ?? 0,
      sort: v.f.sort ?? "name",
      page: 1,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Vitals + tools ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground" style={MONO}>
            {profiles.isLoading ? "—" : total}
          </span>{" "}
          {total === 1 ? "company" : "companies"} · one row per company, enriched by every analyst
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search the firm database"
              placeholder="Search name, HQ, domain…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 w-48 pl-8 transition-[width] focus:w-64 sm:w-56"
            />
          </div>
          <select value={sort} onChange={(e) => setSortCol(e.target.value as ProfileSort)} className={SELECT_CLS} aria-label="Sort">
            {(Object.keys(SORT_LABEL) as ProfileSort[]).map((s) => (
              <option key={s} value={s}>
                Sort: {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <Button
            variant={showFilters || activeFilters.length > 0 ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Filters{activeFilters.length > 0 ? ` · ${activeFilters.length}` : ""}
          </Button>
          <ColumnToggle
            columns={FIRM_COLUMNS}
            isVisible={firmCols.isVisible}
            onToggle={firmCols.toggle}
            hiddenCount={firmCols.hiddenCount}
          />
          {isPartner && (
            <Button
              variant={groupByAnalyst ? "secondary" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => patchUrl({ by: groupByAnalyst ? "0" : "1" })}
              aria-pressed={groupByAnalyst}
            >
              <Users className="mr-1.5 h-3.5 w-3.5" aria-hidden /> By analyst
            </Button>
          )}
        </div>
      </div>

      {/* ── Facets ── */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <select
              value={categoryId}
              onChange={(e) => patchUrl({ category_id: Number(e.target.value), page: 1 })}
              className={cn(SELECT_CLS, "text-xs")}
            >
              <option value={0}>Any</option>
              {categories?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Engagement</label>
            <select
              value={engagementType}
              onChange={(e) => patchUrl({ engagement_type: e.target.value, page: 1 })}
              className={cn(SELECT_CLS, "text-xs")}
            >
              <option value="">Any</option>
              {Object.entries(ENGAGEMENT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => patchUrl({ status: e.target.value, page: 1 })}
              className={cn(SELECT_CLS, "text-xs")}
            >
              <option value="">Any</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Min engagements</label>
            <select
              value={minEng}
              onChange={(e) => patchUrl({ min_engagements: Number(e.target.value), page: 1 })}
              className={cn(SELECT_CLS, "text-xs")}
            >
              <option value={0}>Any</option>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  ≥ {n}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {savingView ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveView()}
                  placeholder="View name…"
                  className="h-8 w-32 text-xs"
                />
                <Button onClick={saveView}>
                  Save
                </Button>
                <button
                  onClick={() => setSavingView(false)}
                  aria-label="Cancel saving view"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setSavingView(true)}>
                <Bookmark className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Save view
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Active filter + saved-view chips ── */}
      {(activeFilters.length > 0 || views.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map((f, i) => (
            <button
              key={i}
              onClick={f.clear}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-accent px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {f.label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          {views.length > 0 && <span className="ml-1 text-xs text-muted-foreground">Views:</span>}
          {views.map((v) => (
            <span key={v.name} className="inline-flex items-center gap-0.5 rounded-full border py-0.5 pl-2.5 pr-1 text-xs">
              <button
                onClick={() => applyView(v)}
                className="rounded py-0.5 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {v.name}
              </button>
              <button
                onClick={() => persistViews(views.filter((x) => x.name !== v.name))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive-ink focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Delete view ${v.name}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      {byAnalyst && byAnalyst.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {byAnalyst.map((a) => (
            <span key={a.analyst_name} className="rounded-md border px-2 py-0.5">
              {a.analyst_name}:{" "}
              <span className="font-semibold tabular-nums" style={MONO}>
                {a.profiles}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── The universe grid ── */}
      {profiles.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
          <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden />
          <p className="text-sm font-medium">Couldn&rsquo;t load the firm database.</p>
          <button onClick={() => profiles.refetch()} className="text-xs font-medium text-primary-ink hover:underline">
            Try again
          </button>
        </div>
      ) : profiles.isLoading ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="h-9 border-b border-border bg-muted/20" />
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="border-b border-border px-4 py-3 last:border-0">
              <div className="h-4 w-1/3 animate-pulse rounded bg-ink-100" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-ink-100" />
            </div>
          ))}
        </div>
      ) : !profiles.data?.items.length ? (
        <EmptyState
          icon={Building2}
          title="No companies match"
          description={q || activeFilters.length ? "Try widening your search or filters." : "Add companies from an engagement or here."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="max-h-[calc(100vh-13rem)] overflow-auto">
            <table className="w-full min-w-[352px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH_STICKY, "w-9 px-2 py-2.5")}>
                    <button
                      onClick={() => setSelected((prev) => toggleMany(prev, pageIds))}
                      aria-label={allPageSelected ? "Clear selection" : "Select all on this page"}
                      aria-pressed={allPageSelected}
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                        allPageSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:border-border-strong",
                      )}
                    >
                      {allPageSelected && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                    </button>
                  </th>
                  <SortHeader label="Company" col="name" active={sort === "name"} onClick={setSortCol} className={TH_STICKY} />
                  {firmCols.isVisible("worked") && (
                    <th scope="col" className={cn(TH_CLS, TH_STICKY, "hidden md:table-cell")}>
                      Worked by
                    </th>
                  )}
                  {firmCols.isVisible("revenue") && (
                    <SortHeader label="Rev ₹Cr" col="revenue" active={sort === "revenue"} onClick={setSortCol} align="right" className={cn(TH_STICKY, "hidden sm:table-cell")} />
                  )}
                  {firmCols.isVisible("headcount") && (
                    <SortHeader label="Staff" col="headcount" active={sort === "headcount"} onClick={setSortCol} align="right" className={cn(TH_STICKY, "hidden sm:table-cell")} />
                  )}
                  {firmCols.isVisible("deals") && (
                    <SortHeader label="Deals" col="engagements" active={sort === "engagements"} onClick={setSortCol} align="right" className={TH_STICKY} />
                  )}
                </tr>
              </thead>
              <tbody>
                {profiles.data.items.map((p: CompanyProfile) => (
                  <tr
                    key={p.id}
                    className={cn(
                      "group border-b border-border transition-colors last:border-0 hover:bg-muted/40",
                      selected.has(p.id) && "bg-subtle hover:bg-subtle",
                    )}
                  >
                    <td className="w-9 px-2 py-2.5 align-top">
                      <button
                        onClick={() => toggleProfile(p.id)}
                        aria-label={selected.has(p.id) ? `Deselect ${p.company_name}` : `Select ${p.company_name}`}
                        aria-pressed={selected.has(p.id)}
                        className={cn(
                          "mt-0.5 flex h-4 w-4 items-center justify-center rounded border transition-all focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                          selected.has(p.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : cn(
                                "border-input hover:border-border-strong",
                                selected.size > 0 ? "opacity-70" : "opacity-0 group-hover:opacity-100",
                              ),
                        )}
                      >
                        {selected.has(p.id) && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                      </button>
                    </td>
                    <td className="max-w-0 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        {p.placements[0] ? (
                          <Link
                            href={`/companies/${p.placements[0].company_id}`}
                            className="truncate rounded text-[13px] font-semibold tracking-tight outline-none transition-colors hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            {p.company_name}
                          </Link>
                        ) : (
                          <span className="truncate text-[13px] font-semibold tracking-tight">{p.company_name}</span>
                        )}
                        {p.overlap && (
                          <span
                            title="Worked by more than one analyst"
                            className="shrink-0 rounded-[3px] border border-foreground px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                          >
                            overlap
                          </span>
                        )}
                        {p.website && (
                          <a
                            href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${p.company_name} website`}
                            className="shrink-0 rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            <Globe className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        )}
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        {p.hq && <span className="truncate">{p.hq}</span>}
                        {p.placements.slice(0, 4).map((pl) => (
                          <PlacementChip key={pl.company_id} p={pl} />
                        ))}
                        {p.placements.length > 4 && (
                          <span className="text-[11px] tabular-nums" style={MONO}>
                            +{p.placements.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    {firmCols.isVisible("worked") && (
                      <td className="hidden whitespace-nowrap px-3 py-2.5 md:table-cell">
                        <WorkedBy placements={p.placements} />
                      </td>
                    )}
                    {firmCols.isVisible("revenue") && (
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell">
                        <span className="text-xs tabular-nums text-secondary-foreground" style={MONO}>
                          {p.revenue_inr_cr ? Number(p.revenue_inr_cr).toLocaleString() : "—"}
                        </span>
                      </td>
                    )}
                    {firmCols.isVisible("headcount") && (
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell">
                        <span className="text-xs tabular-nums text-secondary-foreground" style={MONO}>
                          {p.headcount ? p.headcount.toLocaleString() : "—"}
                        </span>
                      </td>
                    )}
                    {firmCols.isVisible("deals") && (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <span className="text-xs font-semibold tabular-nums" style={MONO}>
                          {p.engagement_count}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs text-muted-foreground tabular-nums" style={MONO}>
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => patchUrl({ page: Math.max(1, page - 1) })} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => patchUrl({ page: Math.min(totalPages, page + 1) })}
              disabled={page === totalPages}
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <BulkBar count={selected.size} noun={selected.size === 1 ? "company" : "companies"} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="outline" className="h-7" onClick={exportSelectedProfiles}>
          <Download className="mr-1 h-3.5 w-3.5" aria-hidden /> Export
        </Button>
      </BulkBar>
    </div>
  );
}
