"use client";

/**
 * The deal floor — every project the firm is running, ranked by what needs doing.
 *
 * The list's job is narrow and it stays narrow: understand the health of every project
 * before opening one. So it is a register, not a dashboard:
 *
 *   • the header states the finding in one sentence ("24 follow-ups are late across
 *     3 projects"), because a number without a sentence still has to be interpreted
 *   • every row carries its book as one health bar on a shared scale, so the floor's
 *     shape — which projects are big, which are slipping — reads before a word does
 *   • every figure is a door: the late count opens the workspace already filtered to
 *     late, open work opens Work, the response rate opens Analytics
 *   • the columns close on a ruled total, the way a banker's table does
 *
 * Sorting is attention-first and is not a control: a project with 24 late follow-ups is
 * the one you should be looking at, and making that a preference is how it stops being
 * true. Search and the active/archived scope are the only two knobs, and both live in
 * the URL so a filtered floor is a link you can send someone.
 *
 * Keyboard-first like the register it leads into: ↑/↓ (or j/k) walk the rows, Enter
 * opens one, "/" searches, N starts a new project.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronRight,
  FileSpreadsheet,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Rows3,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";
import { DeleteProjectDialog } from "@/components/features/delete-project-dialog";
import { MandateDialog } from "@/components/features/mandate-dialog";
import { HealthBar, HealthLegend } from "@/components/project/health-bar";
import { AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useArchiveProject, useCreateProject, useProjects } from "@/hooks/use-projects";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import {
  DEAL_TYPE_SHORT,
  INK_LINK,
  KBD,
  LABEL,
  LATE_TOKEN,
  MONO,
  PAGE_TITLE,
  PAGE_TITLE_STYLE,
  PANEL,
  SEG_GROUP,
  SEG_ITEM,
  SEG_ITEM_OFF,
  SEG_ITEM_ON,
} from "@/lib/design";
import { fmtDate } from "@/lib/format";
import { SIDE_ORDER, type Vitals } from "@/lib/project";
import { workspaceHref } from "@/lib/project-views";
import { enumParam, stringParam, type ParamSpec } from "@/lib/table-url-state";
import { toastUndo } from "@/lib/undo-toast";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

/** MODULE SCOPE — `useTableUrlState` leaves the spec out of its effect deps on purpose. */
const PROJECTS_SPEC = {
  q: stringParam(""),
  scope: enumParam(["active", "archived", "all"] as const, "active"),
} satisfies ParamSpec;

const SCOPES = [
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
] as const;

/**
 * One column template for the key, every row and the total — so each figure stacks
 * exactly under its heading and "274" and "47" sit in the same column, not wherever
 * their width happens to leave them. Below `lg` rows fall back to a wrapping flex line
 * and name their own figures.
 */
const COLS =
  "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(9rem,13rem)_repeat(5,4.5rem)_6.5rem] lg:items-center lg:gap-x-2";

/** Elements whose keystrokes belong to themselves, not to the floor. */
const SKIP_KEYS_INSIDE = '[role="dialog"], [role="menu"], [role="listbox"]';

/* ── Derivations ───────────────────────────────────────────────────────────── */

/**
 * The list payload's rollups, shaped for the shared health bar. `responded` is the
 * server's status count; the rate is only a fallback for a cached payload that predates
 * the field.
 */
function vitalsOfProject(p: Project): Vitals {
  const total = p.total_companies ?? 0;
  return {
    total,
    contacted: total,
    replied: p.responded ?? Math.round((p.response_rate ?? 0) * total),
    late: p.overdue_count ?? 0,
    awaiting: p.needs_initial_count ?? 0,
    cold: p.cold_count ?? 0,
    noContact: 0,
    replyRate: p.response_rate ?? 0,
  };
}

/** The deal's shape in words — "Sell 120 · Buy 40" — under its bar. */
function sidesCaption(p: Project): string {
  const present = SIDE_ORDER.filter((s) => (p.sides?.[s]?.companies ?? 0) > 0);
  if (present.length > 0) {
    return present.map((s) => `${DEAL_TYPE_SHORT[s]} ${p.sides![s].companies}`).join(" · ");
  }
  const n = p.mandate_count ?? 0;
  return n === 0 ? "No engagements yet" : `${n} ${n === 1 ? "engagement" : "engagements"} · no companies yet`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/* ── The page ──────────────────────────────────────────────────────────────── */

export default function ProjectsPage() {
  const router = useRouter();
  const [urlState, patchUrl] = useTableUrlState(PROJECTS_SPEC);
  const scope = urlState.scope;
  const search = urlState.q;
  // "All" and "Archived" both need archived rows from the server; the split between
  // them happens below, on the returned list.
  const includeArchived = scope !== "active";

  const [deleteFor, setDeleteFor] = useState<Project | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addEngagementFor, setAddEngagementFor] = useState<Project | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, refetch } = useProjects(includeArchived);
  const archive = useArchiveProject();
  const confirm = useConfirm();

  const items = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scoped =
      scope === "archived"
        ? items.filter((p) => !!p.archived_at)
        : scope === "active"
          ? items.filter((p) => !p.archived_at)
          : items;
    const base = q
      ? scoped.filter(
          (p) => p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q),
        )
      : scoped;
    // Attention-first: late desc, then most-recent activity, then name. Archived last.
    return [...base].sort((a, b) => {
      const aArch = a.archived_at ? 1 : 0;
      const bArch = b.archived_at ? 1 : 0;
      if (aArch !== bArch) return aArch - bArch;
      const late = (b.overdue_count ?? 0) - (a.overdue_count ?? 0);
      if (late !== 0) return late;
      const al = a.last_activity ?? "";
      const bl = b.last_activity ?? "";
      if (al !== bl) return bl.localeCompare(al);
      return a.name.localeCompare(b.name);
    });
  }, [items, search, scope]);

  // One scale for every bar on the floor, so a 40-company book looks small next to a
  // 400-company one — which is the comparison the floor exists for.
  const maxCompanies = useMemo(
    () => Math.max(1, ...items.map((p) => p.total_companies ?? 0)),
    [items],
  );

  /** The live floor — never the archived rows — for the header's sentence. */
  const floor = useMemo(() => {
    const active = items.filter((p) => !p.archived_at);
    let late = 0;
    let lateProjects = 0;
    let intro = 0;
    let companies = 0;
    for (const p of active) {
      const l = p.overdue_count ?? 0;
      late += l;
      if (l > 0) lateProjects += 1;
      intro += p.needs_initial_count ?? 0;
      companies += p.total_companies ?? 0;
    }
    return {
      projects: active.length,
      archived: items.length - active.length,
      late,
      lateProjects,
      intro,
      companies,
    };
  }, [items]);

  /** The ruled total under the columns — over exactly the rows on screen. */
  const totals = useMemo(() => {
    let engagements = 0;
    let companies = 0;
    let responded = 0;
    let late = 0;
    let intro = 0;
    let work = 0;
    let overdueWork = 0;
    for (const p of filtered) {
      const v = vitalsOfProject(p);
      engagements += p.mandate_count ?? 0;
      companies += v.total;
      responded += v.replied;
      late += v.late;
      intro += v.awaiting;
      work += p.open_task_count ?? 0;
      overdueWork += p.overdue_task_count ?? 0;
    }
    return { engagements, companies, responded, late, intro, work, overdueWork };
  }, [filtered]);

  /* ── Keyboard ──────────────────────────────────────────────────────────── */

  /**
   * The keyboard cursor, tagged with the list it was placed in.
   *
   * Search and scope rebuild the list, and an index that outlived its list would point
   * at whichever project inherited the position. Tagging the cursor with its list makes
   * a stale one read as no cursor at all — nothing has to be reset when the list moves.
   */
  const listKey = `${scope}|${search}`;
  const [mark, setMark] = useState<{ list: string; index: number } | null>(null);
  const cursor = mark && mark.list === listKey ? mark.index : null;
  // Mirrored in a ref so two keydowns in one tick (a held arrow) both see the live
  // position; state alone would hand both presses the same starting row.
  const markRef = useRef<{ list: string; index: number } | null>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  const place = useCallback(
    (i: number | null, scroll = true) => {
      const prev = markRef.current;
      if (i != null && prev?.list === listKey && prev.index === i) return;
      const next = i == null ? null : { list: listKey, index: i };
      markRef.current = next;
      setMark(next);
      if (i != null && scroll) rowRefs.current[i]?.scrollIntoView({ block: "nearest" });
    },
    [listKey],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest(SKIP_KEYS_INSIDE)) return;
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing) {
        if (e.key === "Escape" && t === searchRef.current) searchRef.current?.blur();
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setCreateOpen(true);
        return;
      }
      if (filtered.length === 0) return;

      const m = markRef.current;
      const cur = m && m.list === listKey ? m.index : null;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        place(cur == null ? 0 : Math.min(filtered.length - 1, cur + 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        place(cur == null ? filtered.length - 1 : Math.max(0, cur - 1));
      } else if (e.key === "Enter" && cur != null && filtered[cur]) {
        e.preventDefault();
        router.push(`/projects/${filtered[cur].id}`);
      } else if (e.key === "Escape") {
        place(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, router, place, listKey]);

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const handleArchiveToggle = async (p: Project) => {
    const archived = !!p.archived_at;
    const verb = archived ? "restore" : "archive";
    const ok = await confirm({
      title: archived ? `Restore "${p.name}"?` : `Archive "${p.name}"?`,
      description: archived
        ? "It returns to the deal floor with its engagements intact."
        : "The project and its engagements drop off the deal floor. Nothing is destroyed — undo straight after, or restore from the archived filter.",
      confirmLabel: archived ? "Restore" : "Archive",
      tone: archived ? "default" : "destructive",
    });
    if (!ok) return;
    try {
      await archive.mutateAsync({ id: p.id, archived });
      if (archived) {
        toast.success("Project restored");
      } else {
        toastUndo(`"${p.name}" archived`, () => archive.mutateAsync({ id: p.id, archived: true }));
      }
    } catch {
      toast.error(`Failed to ${verb} project`);
    }
  };

  const hasProjects = items.length > 0;
  const showRegister = !isLoading && !error && filtered.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
            Projects
          </h1>
          {hasProjects && (
            <FindingLine
              scope={scope}
              projects={floor.projects}
              archived={floor.archived}
              late={floor.late}
              lateProjects={floor.lateProjects}
              intro={floor.intro}
              companies={floor.companies}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search projects"
              value={search}
              onChange={(e) => patchUrl({ q: e.target.value })}
              placeholder="Search projects"
              className="h-8 w-44 bg-card pl-8 pr-7 transition-[width] focus:w-60"
            />
            {!search && (
              <kbd className={cn(KBD, "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2")}>
                /
              </kbd>
            )}
          </div>

          {/* Three states, not a boolean: "show archived too" and "show me only what
              I archived" are different questions, and the second is the one you ask
              when you are about to delete something. */}
          <div className={SEG_GROUP} role="group" aria-label="Filter by status">
            {SCOPES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={scope === opt.id}
                onClick={() => patchUrl({ scope: opt.id })}
                className={cn(SEG_ITEM, scope === opt.id ? SEG_ITEM_ON : SEG_ITEM_OFF)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* A firm imports one workbook per client, so this stays available after
              the first one — the empty state's own button is gone by then. */}
          <Link href="/import">
            <Button variant="outline" data-testid="import-from-excel-header">
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Import from Excel
            </Button>
          </Link>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </Button>
        </div>
      </header>

      {/* ── The floor ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <FloorSkeleton />
      ) : error ? (
        <div className={cn(PANEL, "flex flex-col items-center justify-center gap-2 py-16 text-center")}>
          <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden />
          <p className="text-sm font-medium">Couldn&rsquo;t load projects.</p>
          <p className="text-xs text-muted-foreground">The server didn&rsquo;t answer. Nothing on the floor has changed.</p>
          <button onClick={() => refetch()} className={cn(INK_LINK, "mt-1 text-xs")}>
            Try again
          </button>
        </div>
      ) : !hasProjects ? (
        <FloorEmpty onCreate={() => setCreateOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className={cn(PANEL, "flex flex-col items-center justify-center gap-2 py-16 text-center")}>
          {/* Name whichever filter is actually hiding everything — with a scope but no
              search term, "No projects match “”" is nonsense and points at the wrong
              control to undo. */}
          {search ? (
            <>
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">
                No projects match &ldquo;{search}&rdquo;
                {scope !== "all" && ` in ${scope} projects`}.
              </p>
              <button onClick={() => patchUrl({ q: "" })} className={cn(INK_LINK, "text-xs")}>
                Clear search
              </button>
            </>
          ) : (
            <>
              <Archive className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">
                {scope === "archived" ? "Nothing has been archived." : "No active projects."}
              </p>
              <button onClick={() => patchUrl({ scope: "all" })} className={cn(INK_LINK, "text-xs")}>
                Show all projects
              </button>
            </>
          )}
        </div>
      ) : (
        <section className={cn(PANEL, "overflow-hidden")} aria-label="Projects">
          {/* The column key. Laid out on the rows' own track widths, so it reads as a
              heading over columns rather than a caption floating above them. */}
          <div
            className={cn(
              "hidden border-b border-border bg-muted/50 px-4 py-2",
              COLS,
            )}
            aria-hidden
          >
            <span className={LABEL}>Project</span>
            <span className={LABEL}>Book</span>
            {["Companies", "Late", "Intro", "Responded", "Work"].map((h) => (
              <span key={h} className={cn(LABEL, "px-1.5 text-right")}>
                {h}
              </span>
            ))}
            <span className={cn(LABEL, "text-right")}>Team</span>
          </div>

          <ul className="divide-y divide-border">
            {filtered.map((project, i) => (
              <ProjectRow
                key={project.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                project={project}
                index={i}
                cursor={cursor === i}
                maxCompanies={maxCompanies}
                onHover={() => place(i, false)}
                onAddEngagement={setAddEngagementFor}
                onArchiveToggle={handleArchiveToggle}
                onDelete={setDeleteFor}
              />
            ))}
          </ul>

          {/* The ruled total — over exactly the rows above it, never the firm. */}
          <div
            className={cn("hidden border-t border-foreground bg-muted/40 px-4 py-2.5", COLS)}
            data-testid="floor-total"
          >
            <span className="text-xs font-semibold text-foreground">
              Total
              <span className="ml-1.5 font-normal text-muted-foreground">
                {filtered.length} {plural(filtered.length, "project", "projects")}
              </span>
            </span>
            <span className="text-xs text-muted-foreground" style={MONO}>
              {totals.engagements} {plural(totals.engagements, "engagement", "engagements")}
            </span>
            <TotalFigure value={totals.companies} />
            <TotalFigure value={totals.late} late />
            <TotalFigure value={totals.intro} italic />
            <span className="px-1.5 text-right text-sm font-semibold tabular-nums" style={MONO}>
              {totals.companies > 0 ? `${Math.round((totals.responded / totals.companies) * 100)}%` : "—"}
            </span>
            <TotalFigure value={totals.work} marked={totals.overdueWork > 0} />
            <span />
          </div>
        </section>
      )}

      {showRegister && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1">
          <HealthLegend />
          <p className="hidden items-center gap-3 text-[11px] text-muted-foreground lg:flex">
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>↑</kbd>
              <kbd className={KBD}>↓</kbd> move
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>↵</kbd> open
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>/</kbd> search
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>N</kbd> new project
            </span>
          </p>
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* One shared engagement dialog, driven by the row menu. */}
      {addEngagementFor && (
        <MandateDialog
          key={addEngagementFor.id}
          projectId={addEngagementFor.id}
          defaultClientName={addEngagementFor.client_name}
          open
          onOpenChange={(o) => !o && setAddEngagementFor(null)}
          trigger={null}
        />
      )}

      {/* One shared delete dialog, driven by the row menu. */}
      {deleteFor && (
        <DeleteProjectDialog
          key={deleteFor.id}
          projectId={deleteFor.id}
          projectName={deleteFor.name}
          open
          onOpenChange={(o) => !o && setDeleteFor(null)}
        />
      )}
    </div>
  );
}

/* ── The finding ───────────────────────────────────────────────────────────── */

/**
 * The floor, in one sentence. A count in a header has to be interpreted; a sentence has
 * already been. It speaks about the live floor only — archived projects are not late,
 * they are off the floor.
 */
function FindingLine({
  scope,
  projects,
  archived,
  late,
  lateProjects,
  intro,
  companies,
}: {
  scope: "active" | "archived" | "all";
  projects: number;
  archived: number;
  late: number;
  lateProjects: number;
  intro: number;
  companies: number;
}) {
  const figure = (n: number) => (
    <span className="font-medium tabular-nums text-foreground" style={MONO}>
      {n}
    </span>
  );

  let body: React.ReactNode;
  if (scope === "archived") {
    body = (
      <>
        {figure(archived)} archived {plural(archived, "project", "projects")} — off the floor,
        restorable in one click.
      </>
    );
  } else if (projects === 0) {
    body = <>Every project is archived. Restore one to put it back on the floor.</>;
  } else if (companies === 0) {
    body = <>No companies on the floor yet — open an engagement, or import a client&rsquo;s workbook.</>;
  } else if (late > 0) {
    body = (
      <>
        <span className={LATE_TOKEN} style={MONO}>
          {late}
        </span>{" "}
        {plural(late, "follow-up is", "follow-ups are")} late across {figure(lateProjects)}{" "}
        {plural(lateProjects, "project", "projects")}
        {intro > 0 && (
          <>
            , and {figure(intro)} {plural(intro, "intro has", "intros have")} not gone out
          </>
        )}
        .
      </>
    );
  } else if (intro > 0) {
    body = (
      <>
        Nothing is late. {figure(intro)} {plural(intro, "intro has", "intros have")} not gone
        out yet.
      </>
    );
  } else {
    body = (
      <>
        Nothing is late across {figure(projects)} {plural(projects, "project", "projects")}, and
        every intro has gone out.
      </>
    );
  }

  return (
    <p className="mt-1.5 text-sm leading-6 text-muted-foreground" data-testid="floor-finding">
      {body}
    </p>
  );
}

/* ── The row ───────────────────────────────────────────────────────────────── */

/**
 * A figure pointing at the view that can act on it.
 *
 * `stopPropagation` is what keeps the whole row clickable *and* each figure separately
 * clickable — without it, aiming at "24 late" would open the overview, which is the one
 * place that cannot show you those twenty-four rows.
 */
function Figure({
  label,
  href,
  title,
  children,
}: {
  label: string;
  href: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      title={title}
      className="flex min-w-[3.25rem] flex-col items-end rounded-md px-1.5 py-1 text-right outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/50 lg:min-w-0"
    >
      <span className="text-sm font-semibold leading-5 tabular-nums text-foreground" style={MONO}>
        {children}
      </span>
      {/* The key names the figures on wide screens; below `lg` there is no key, so the
          row names its own. */}
      <span className="text-[11px] text-muted-foreground lg:hidden">
        {label}
      </span>
    </Link>
  );
}

const Zero = () => <span className="font-normal text-muted-foreground">0</span>;

function ProjectRow({
  ref,
  project,
  index,
  cursor,
  maxCompanies,
  onHover,
  onAddEngagement,
  onArchiveToggle,
  onDelete,
}: {
  ref: React.Ref<HTMLLIElement>;
  project: Project;
  index: number;
  cursor: boolean;
  maxCompanies: number;
  onHover: () => void;
  onAddEngagement: (p: Project) => void;
  onArchiveToggle: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const router = useRouter();
  const archived = !!project.archived_at;
  const vitals = vitalsOfProject(project);
  const openWork = project.open_task_count ?? 0;
  const overdueWork = project.overdue_task_count ?? 0;
  const respondedPct = Math.round((project.response_rate ?? 0) * 100);
  const showClient = project.client_name && project.client_name.trim() !== project.name.trim();
  const base = `/projects/${project.id}`;

  // `members` is the server's union (assigned + engagement + creator); `team` is the
  // older names-only key, kept as the fallback.
  const team = project.members?.length
    ? project.members.map((m) => m.full_name)
    : (project.team ?? []);

  return (
    <li ref={ref}>
      <div
        className={cn(
          "group relative flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 transition-colors lg:py-2.5",
          COLS,
          cursor && "bg-muted",
        )}
        data-cursor={cursor || undefined}
        onMouseEnter={onHover}
        onClick={() => router.push(base)}
      >
        {/* Identity */}
        <div className="min-w-0 basis-full sm:basis-0 sm:grow lg:basis-auto">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={base}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "truncate text-[15px] font-semibold tracking-tight underline-offset-4 outline-none hover:underline focus-visible:underline",
                archived ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {project.name}
            </Link>
            {archived && (
              <span className="shrink-0 rounded-[3px] border border-border px-1 text-[11px] font-medium leading-4 text-muted-foreground">
                Archived
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {showClient && (
              <>
                {project.client_name}
                <span aria-hidden> · </span>
              </>
            )}
            {project.last_activity ? (
              <>
                Last outreach{" "}
                <span className="tabular-nums" style={MONO}>
                  {fmtDate(project.last_activity)}
                </span>
              </>
            ) : (
              "No outreach yet"
            )}
          </p>
        </div>

        {/* The book — size and state on the floor's one scale */}
        <div className="w-full sm:w-44 lg:w-auto">
          <HealthBar vitals={vitals} scaleTo={maxCompanies} delay={Math.min(index, 12) * 25} />
          <p className="mt-1 truncate text-[10px] tabular-nums text-muted-foreground" style={MONO}>
            {sidesCaption(project)}
          </p>
        </div>

        {/* Five figures, each one a door */}
        <div className="flex items-start gap-0.5 lg:contents">
          <Figure label="Cos" href={`${base}/workspace`}>
            {vitals.total > 0 ? vitals.total : <Zero />}
          </Figure>
          <Figure
            label="Late"
            href={workspaceHref(project.id, { view: "follow-ups" })}
            title={vitals.late > 0 ? `${vitals.late} follow-ups past due` : "Nothing late"}
          >
            {vitals.late > 0 ? <span className={LATE_TOKEN}>{vitals.late}</span> : <Zero />}
          </Figure>
          <Figure
            label="Intro"
            href={workspaceHref(project.id, { view: "intro-pending" })}
            title={vitals.awaiting > 0 ? `${vitals.awaiting} intros not yet sent` : "Every intro sent"}
          >
            {vitals.awaiting > 0 ? <span>{vitals.awaiting}</span> : <Zero />}
          </Figure>
          <Figure label="Resp." href={`${base}/analytics`} title="Companies that responded, over the whole book">
            {vitals.total > 0 ? (
              `${respondedPct}%`
            ) : (
              <span className="font-normal text-muted-foreground">—</span>
            )}
          </Figure>
          <Figure
            label="Work"
            href={`${base}/work`}
            title={
              openWork > 0
                ? `${openWork} open${overdueWork > 0 ? ` · ${overdueWork} overdue` : ""}`
                : "No open work"
            }
          >
            {openWork > 0 ? (
              <span className="inline-flex items-center gap-1">
                {overdueWork > 0 && (
                  <span className="size-1.5 rounded-full bg-danger" aria-label={`${overdueWork} overdue`} />
                )}
                {openWork}
              </span>
            ) : (
              <Zero />
            )}
          </Figure>
        </div>

        {/* Team + actions */}
        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 lg:ml-0">
          <AvatarGroup names={team} max={3} size="sm" className="hidden sm:inline-flex" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    "text-muted-foreground transition-opacity hover:text-foreground data-[popup-open]:opacity-100",
                    cursor ? "lg:opacity-100" : "lg:opacity-0 lg:focus-visible:opacity-100",
                  )}
                  aria-label={`Actions for ${project.name}`}
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem render={<Link href={base} />}>
                <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden /> Open project
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`${base}/workspace`} />}>
                <Rows3 className="h-4 w-4 text-muted-foreground" aria-hidden /> Open workspace
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddEngagement(project)}>
                <Plus className="h-4 w-4 text-muted-foreground" aria-hidden /> Add engagement
              </DropdownMenuItem>
              {/* Archive is not partner-gated: it is reversible in one click, and it is
                  the first of the two steps permanent delete requires. */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onArchiveToggle(project)}>
                {archived ? (
                  <ArchiveRestore className="h-4 w-4 text-muted-foreground" aria-hidden />
                ) : (
                  <Archive className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
                {archived ? "Restore project" : "Archive project"}
              </DropdownMenuItem>
              {/* Only once archived. The server refuses with a 409 either way; keeping
                  it out of the ordinary flow is the rail that does the work. */}
              {archived && (
                <DropdownMenuItem onClick={() => onDelete(project)}>
                  <Trash2 className="h-4 w-4 text-foreground" aria-hidden />
                  <span className="font-medium">Delete permanently</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight
            className={cn(
              "hidden h-4 w-4 shrink-0 transition-colors sm:block",
              cursor ? "text-foreground" : "text-ink-300",
            )}
            aria-hidden
          />
        </div>
      </div>
    </li>
  );
}

function TotalFigure({
  value,
  late,
  italic,
  marked,
}: {
  value: number;
  late?: boolean;
  italic?: boolean;
  /** A dot beside the figure — something inside the total is overdue. */
  marked?: boolean;
}) {
  return (
    <span className="px-1.5 text-right text-sm font-semibold tabular-nums" style={MONO}>
      {value === 0 ? (
        <span className="font-normal text-muted-foreground">0</span>
      ) : late ? (
        <span className={LATE_TOKEN}>{value}</span>
      ) : (
        <span className={cn("inline-flex items-center gap-1", italic && "font-medium")}>
          {marked && <span className="size-1.5 rounded-full bg-danger" aria-hidden />}
          {value}
        </span>
      )}
    </span>
  );
}

/* ── States ────────────────────────────────────────────────────────────────── */

function FloorSkeleton() {
  return (
    <div className={cn(PANEL, "overflow-hidden")} aria-busy="true" aria-label="Loading projects">
      <div className="hidden h-8 border-b border-border bg-muted/50 lg:block" />
      <ul className="divide-y divide-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className={cn("flex flex-wrap items-center gap-4 px-4 py-3.5", COLS)}>
            <span className="flex flex-col gap-1.5">
              <span className="h-3.5 w-48 animate-pulse rounded bg-ink-100" />
              <span className="h-2.5 w-32 animate-pulse rounded bg-ink-100" />
            </span>
            <span className="h-2 w-40 animate-pulse rounded-[2px] bg-ink-100 lg:w-full" />
            {[0, 1, 2, 3, 4].map((f) => (
              <span key={f} className="ml-auto hidden h-3.5 w-8 animate-pulse rounded bg-ink-100 lg:block" />
            ))}
            <span className="ml-auto h-6 w-14 animate-pulse rounded-full bg-ink-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * First run. The empty floor is the one moment a firm is taught how the product is
 * organised, so it says so — in the order the structure actually fills up.
 */
function FloorEmpty({ onCreate }: { onCreate: () => void }) {
  const steps = [
    {
      title: "Open a project",
      body: "One per client. It holds everything you run for them.",
    },
    {
      title: "Add an engagement",
      body: "A sell-side, a buy-side or a capital raise — each is its own book with its own cadence.",
    },
    {
      title: "Fill the book",
      body: "Add companies one at a time, or import the client’s workbook with its outreach history intact.",
    },
  ];
  return (
    <section className={cn(PANEL, "px-6 py-12 sm:px-10")}>
      <div className="mx-auto max-w-2xl">
        <h2 className="text-lg font-semibold tracking-tight">No projects on the floor yet.</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Start a project for a client, or bring a whole workbook over from Excel.
        </p>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="bg-card p-4">
              <span
                className="grid size-5 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background"
                style={MONO}
                aria-hidden
              >
                {i + 1}
              </span>
              <p className="mt-2.5 text-sm font-medium">{s.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </Button>
          {/* Onboarding: the client's real workbook, history and all. */}
          <Link href="/import">
            <Button variant="outline" data-testid="import-from-excel">
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Import from Excel
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Create ────────────────────────────────────────────────────────────────── */

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientTouched, setClientTouched] = useState(false);
  const create = useCreateProject();

  const reset = () => {
    setName("");
    setClientName("");
    setClientTouched(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = (clientTouched ? clientName : name).trim();
    if (!name.trim() || !client) return;
    try {
      const project = await create.mutateAsync({ name: name.trim(), client_name: client });
      toast.success("Project created");
      onOpenChange(false);
      reset();
      router.push(`/projects/${project.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              placeholder="e.g. Medanta Healthcare"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-client">Client name</Label>
            <Input
              id="proj-client"
              placeholder="e.g. Medanta Ltd."
              value={clientTouched ? clientName : name}
              onChange={(e) => {
                setClientTouched(true);
                setClientName(e.target.value);
              }}
              aria-describedby="proj-client-hint"
              required
            />
            <p id="proj-client-hint" className="text-xs text-muted-foreground">
              Follows the project name until you change it — for when the client is a
              different legal entity.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
