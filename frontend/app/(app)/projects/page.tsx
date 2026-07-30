"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ChevronRight,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";
import { toastUndo } from "@/lib/undo-toast";

import { useProjects, useCreateProject, useArchiveProject } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import { MandateDialog } from "@/components/features/mandate-dialog";
import { TableSkeleton } from "@/components/features/table-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DISPLAY, LABEL, MONO, PAGE_TITLE, PAGE_TITLE_STYLE } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { MandateType, Project } from "@/types";


const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTH[m - 1]}` : iso;
}

// Side spectrum — same deal-type hues as Schedule/Master, as solid bar segments.
const SIDE_ORDER: MandateType[] = ["SELL_SIDE", "BUY_SIDE", "CAPITAL_RAISE"];
const SIDE_BAR: Record<MandateType, string> = {
  SELL_SIDE: "bg-emerald-500/70",
  BUY_SIDE: "bg-sky-500/70",
  CAPITAL_RAISE: "bg-violet-500/70",
};
const SIDE_SHORT: Record<MandateType, string> = {
  SELL_SIDE: "Sell",
  BUY_SIDE: "Buy",
  CAPITAL_RAISE: "Raise",
};
const SIDE_LABEL: Record<MandateType, string> = {
  SELL_SIDE: "Sell-side",
  BUY_SIDE: "Buy-side",
  CAPITAL_RAISE: "Capital raise",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Sides spectrum — the list's signature. One typed, load-proportional bar per
//    project: width ∝ companies (global scale across rows), segmented by engagement
//    type. The project's deal shape is legible before a single click. ────────────

function SidesSpectrum({ project, maxCompanies }: { project: Project; maxCompanies: number }) {
  const sides = project.sides;
  const total = project.total_companies ?? 0;
  const widthPct = maxCompanies > 0 && total > 0 ? Math.max(8, (total / maxCompanies) * 100) : 0;

  const present = SIDE_ORDER.filter((s) => (sides?.[s]?.companies ?? 0) > 0);
  const microLabel = present
    .map((s) => `${SIDE_SHORT[s]} ${sides![s].companies}`)
    .join(" · ");
  const title = present
    .map((s) => `${SIDE_LABEL[s]} ${sides![s].companies} ${sides![s].companies === 1 ? "company" : "companies"}`)
    .join(" · ");

  return (
    <div className="w-full sm:w-56" title={title || "No companies yet"}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
        {total > 0 && (
          <div className="horizon-load flex h-full overflow-hidden rounded-full" style={{ width: `${widthPct}%` }}>
            {SIDE_ORDER.map((s) => {
              const co = sides?.[s]?.companies ?? 0;
              if (co === 0) return null;
              return (
                <span
                  key={s}
                  className={cn("h-full", SIDE_BAR[s])}
                  style={{ width: `${(co / total) * 100}%` }}
                />
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-1 truncate text-[10px] tabular-nums text-muted-foreground" style={MONO}>
        {total > 0 ? microLabel : "No companies yet"}
      </div>
    </div>
  );
}

// ── Team stack — overlapping analyst initials, the "who works this" answer ──────

function TeamStack({ team }: { team: string[] }) {
  if (!team || team.length === 0) return null;
  const shown = team.slice(0, 3);
  const extra = team.length - shown.length;
  return (
    <div className="hidden shrink-0 items-center sm:flex" title={team.join(", ")}>
      <div className="flex -space-x-1.5">
        {shown.map((name) => (
          <span
            key={name}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground"
          >
            {initials(name)}
          </span>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-1 text-[10px] tabular-nums text-muted-foreground" style={MONO}>
          +{extra}
        </span>
      )}
    </div>
  );
}

// ── Project row ─────────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  index,
  maxCompanies,
  isPartner,
  onAddEngagement,
  onArchiveToggle,
}: {
  project: Project;
  index: number;
  maxCompanies: number;
  isPartner: boolean;
  onAddEngagement: (p: Project) => void;
  onArchiveToggle: (p: Project) => void;
}) {
  const router = useRouter();
  const archived = !!project.archived_at;
  const late = project.overdue_count ?? 0;
  const intro = project.needs_initial_count ?? 0;
  const replied = Math.round((project.response_rate ?? 0) * 100);
  const total = project.total_companies ?? 0;
  const count = project.mandate_count ?? 0;
  const showClient =
    project.client_name && project.client_name.trim() !== project.name.trim();

  const go = () => router.push(`/projects/${project.id}`);

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 transition-colors hover:bg-muted/40 animate-in fade-in slide-in-from-bottom-1",
        archived && "opacity-60",
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      onClick={go}
    >
      {/* Identity */}
      <div className="min-w-0 grow basis-64">
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${project.id}`}
            onClick={(e) => e.stopPropagation()}
            className="truncate text-[15px] font-semibold tracking-tight text-foreground outline-none hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring"
          >
            {project.name}
          </Link>
          {archived && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[11px] text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {showClient && <span>{project.client_name}</span>}
          {showClient && <span aria-hidden> · </span>}
          <span className="tabular-nums" style={MONO}>{count}</span>{" "}
          {count === 1 ? "engagement" : "engagements"}
          <span aria-hidden> · </span>
          {project.last_activity ? (
            <>Last activity <span className="tabular-nums" style={MONO}>{fmtDate(project.last_activity)}</span></>
          ) : (
            "No outreach yet"
          )}
        </div>
      </div>

      {/* Sides spectrum (signature) */}
      <div className="order-3 w-full shrink-0 sm:order-none sm:w-56">
        <SidesSpectrum project={project} maxCompanies={maxCompanies} />
      </div>

      {/* Health line */}
      <div className="shrink-0 text-xs tabular-nums" style={MONO}>
        {total === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2">
            {late > 0 && <span className="font-medium text-destructive-ink">{late} late</span>}
            {intro > 0 && <span className="text-indigo-600 dark:text-indigo-400">{intro} intro pending</span>}
            <span className="text-muted-foreground">{replied}% replied</span>
          </span>
        )}
      </div>

      {/* Team + actions */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <TeamStack team={project.team ?? []} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground opacity-60 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 lg:opacity-0"
                aria-label={`Actions for ${project.name}`}
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem render={<Link href={`/projects/${project.id}`} />}>
              <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden /> Open project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddEngagement(project)}>
              <Plus className="h-4 w-4 text-muted-foreground" aria-hidden /> Add engagement
            </DropdownMenuItem>
            {isPartner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onArchiveToggle(project)}>
                  <Archive className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {archived ? "Restore project" : "Archive project"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}

// ── Create-project dialog ───────────────────────────────────────────────────────

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
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
              required
            />
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

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [addEngagementFor, setAddEngagementFor] = useState<Project | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, refetch } = useProjects(includeArchived);
  const archive = useArchiveProject();
  const confirm = useConfirm();

  // "/" focuses search (unless typing in a field already).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? items.filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q),
        )
      : items;
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
  }, [items, search]);

  const maxCompanies = useMemo(
    () => Math.max(1, ...items.map((p) => p.total_companies ?? 0)),
    [items],
  );

  const vitals = useMemo(() => {
    const projects = items.length;
    let engagements = 0;
    let companies = 0;
    let late = 0;
    let intro = 0;
    for (const p of items) {
      engagements += p.mandate_count ?? 0;
      companies += p.total_companies ?? 0;
      late += p.overdue_count ?? 0;
      intro += p.needs_initial_count ?? 0;
    }
    return { projects, engagements, companies, late, intro };
  }, [items]);

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
        toastUndo(`"${p.name}" archived`, () =>
          archive.mutateAsync({ id: p.id, archived: true }),
        );
      }
    } catch {
      toast.error(`Failed to ${verb} project`);
    }
  };

  const hasProjects = items.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Command line ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
            Projects
          </h1>
          {hasProjects && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground" style={MONO}>{vitals.projects}</span>{" "}
              {vitals.projects === 1 ? "project" : "projects"} ·{" "}
              <span className="font-medium tabular-nums text-foreground" style={MONO}>{vitals.engagements}</span>{" "}
              {vitals.engagements === 1 ? "engagement" : "engagements"} ·{" "}
              <span className="font-medium tabular-nums text-foreground" style={MONO}>{vitals.companies}</span>{" "}
              companies
              {vitals.late > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-destructive-ink">
                    <span className="tabular-nums" style={MONO}>{vitals.late}</span> late
                  </span>
                </>
              )}
              {vitals.intro > 0 && (
                <>
                  {" · "}
                  <span className="text-indigo-600 dark:text-indigo-400">
                    <span className="tabular-nums" style={MONO}>{vitals.intro}</span> intro pending
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 w-36 pl-8 transition-[width] focus:w-56 sm:w-40"
            />
          </div>
          <button
            type="button"
            onClick={() => setIncludeArchived((v) => !v)}
            aria-pressed={includeArchived}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
              includeArchived
                ? "border-primary/40 bg-primary/10 text-primary-ink"
                : "border-input text-muted-foreground hover:text-foreground",
            )}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Show archived</span>
            <span className="sm:hidden">Archived</span>
          </button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            New project
          </Button>
        </div>
      </div>

      {/* ── The ledger ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton cols={2} rows={5} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden />
            <p className="text-sm font-medium">Couldn&rsquo;t load projects.</p>
            <button onClick={() => refetch()} className="text-xs font-medium text-primary-ink hover:underline">
              Try again
            </button>
          </div>
        ) : !hasProjects ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-sm font-medium">No projects on your desk yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a project for a client — or a partner can assign you to one.
              </p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              New project
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Search className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No projects match &ldquo;{search}&rdquo;.</p>
            <button onClick={() => setSearch("")} className="text-xs text-primary-ink hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((project, i) => (
              <ProjectRow
                key={project.id}
                project={project}
                index={i}
                maxCompanies={maxCompanies}
                isPartner={isPartner}
                onAddEngagement={setAddEngagementFor}
                onArchiveToggle={handleArchiveToggle}
              />
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
