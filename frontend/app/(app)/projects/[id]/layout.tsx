"use client";

/**
 * The project shell — the frame every project view sits inside.
 *
 * The shell owns three things and only three:
 *
 *   1. the project record (fetched once; every view reads it from context)
 *   2. the header — who this is, how it is doing, what you can do to it
 *   3. the dialogs, mounted once so opening one never depends on which view is showing
 *
 * Each view is a route under it. The header does not move between them.
 */

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Building2,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";
import { DeleteProjectDialog } from "@/components/features/delete-project-dialog";
import { MandateDialog } from "@/components/features/mandate-dialog";
import { TaskDialog } from "@/components/features/task-dialog";
import { AddCompanyDialog } from "@/components/features/add-company";
import { Breadcrumbs } from "@/components/layout/page-header";
import { MetricRail, type Metric } from "@/components/project/metric-rail";
import { ProjectNav, type ProjectTab } from "@/components/project/project-nav";
import { ProjectShellProvider } from "@/components/project/project-context";
import { EditProjectDialog, TeamDialog } from "@/components/project/project-dialogs";
import { AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useMandate } from "@/hooks/use-mandates";
import { useArchiveProject, useProject } from "@/hooks/use-projects";
import { fmtDate } from "@/lib/format";
import {
  CHIP,
  CHIP_TONE,
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  INK_LINK,
  LABEL,
  MONO,
  PANEL,
  RECORD_TITLE,
  RECORD_TITLE_STYLE,
} from "@/lib/design";
import { allEngagements, SIDE_ORDER } from "@/lib/project";
import { workspaceHref } from "@/lib/project-views";
import { touchProject } from "@/lib/recent-projects";
import { toastUndo } from "@/lib/undo-toast";
import { cn } from "@/lib/utils";
import type { MandateEngagementStats, TaskCreateInput } from "@/types";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);
  const router = useRouter();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";

  const { data: project, isLoading, error } = useProject(projectId);
  const archiveProject = useArchiveProject();

  const [addEngagementOpen, setAddEngagementOpen] = useState(false);
  const [addCompanyFor, setAddCompanyFor] = useState<MandateEngagementStats | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editEngagementId, setEditEngagementId] = useState<number | null>(null);
  const [taskDefaults, setTaskDefaults] = useState<TaskCreateInput | null>(null);

  const { data: editingMandate } = useMandate(editEngagementId ?? 0);

  // Opening a project is what makes it recent. Recorded here rather than in the
  // sidebar so it is the act of arriving that counts, not the rail happening to render.
  useEffect(() => {
    if (Number.isFinite(projectId) && projectId > 0) touchProject(projectId);
  }, [projectId]);

  const engagements = useMemo(() => allEngagements(project), [project]);

  if (isLoading) return <ProjectShellSkeleton />;

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden />
        <p className="text-sm font-medium">Project not found.</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          It may have been deleted, or it belongs to an engagement you are not on.
        </p>
        <Link href="/projects" className={cn(INK_LINK, "text-xs")}>
          Back to projects
        </Link>
      </div>
    );
  }

  const archived = !!project.archived_at;
  const { headline } = project;
  const openTasks = project.tasks?.open ?? 0;
  const overdueTasks = project.tasks?.overdue ?? 0;
  const replyPct = Math.round((headline.response_rate ?? 0) * 100);
  const showClient = project.client_name.trim() !== project.name.trim();
  const sides = SIDE_ORDER.filter((s) => engagements.some((e) => e.type === s));

  // The server's union (assigned + engagement + creator), with the engagement analysts
  // as the fallback so a cached response from before `members` shipped still renders a
  // team rather than an empty corner.
  const members = project.members?.length
    ? project.members.map((m) => m.full_name).sort()
    : [
        ...new Map(
          engagements.flatMap((e) => (e.analysts ?? []).map((a) => [a.id, a.full_name] as const)),
        ).values(),
      ].sort();

  const base = `/projects/${projectId}`;

  /**
   * The six figures that decide what you do next, each pointing at the view that can
   * do something about it. Late and intro-pending deep-link into the workspace with
   * their own filter already applied — the number and the list behind it are one click
   * apart, not one navigation plus one filter.
   */
  const metrics: Metric[] = [
    {
      key: "engagements",
      label: "Engagements",
      value: engagements.length,
      href: `${base}/details`,
      quiet: engagements.length === 0,
    },
    {
      key: "companies",
      label: "Companies",
      value: headline.total_companies,
      href: `${base}/workspace`,
      quiet: headline.total_companies === 0,
    },
    {
      // "Responded", not "reply rate". This counts companies whose status is RESPONDED,
      // over the whole book — the server's project rollup, which every other project
      // surface reads. Analytics shows a *reply* rate over the contacted subset (any
      // answer), and the two are legitimately different numbers.
      key: "responded",
      label: "Responded",
      value: `${replyPct}%`,
      hint: `${headline.responded} of ${headline.total_companies}`,
      href: `${base}/analytics`,
      tone: "positive",
      quiet: headline.total_companies === 0,
    },
    {
      key: "late",
      label: "Late",
      value: headline.overdue_count,
      href: workspaceHref(projectId, { view: "follow-ups" }),
      tone: "danger",
      quiet: headline.overdue_count === 0,
    },
    {
      key: "intro",
      label: "Intro pending",
      value: headline.needs_initial_count ?? 0,
      href: workspaceHref(projectId, { view: "intro-pending" }),
      tone: "awaiting",
      quiet: (headline.needs_initial_count ?? 0) === 0,
    },
    {
      key: "work",
      label: "Open work",
      value: openTasks,
      hint: overdueTasks > 0 ? `${overdueTasks} overdue` : undefined,
      href: `${base}/work`,
      tone: overdueTasks > 0 ? "danger" : "default",
      quiet: openTasks === 0,
    },
  ];

  const tabs: ProjectTab[] = [
    { key: "overview", label: "Overview", segment: "" },
    { key: "workspace", label: "Workspace", segment: "workspace", count: headline.total_companies },
    {
      key: "work",
      label: "Work",
      segment: "work",
      count: openTasks,
      countTone: overdueTasks > 0 ? "danger" : "default",
    },
    { key: "analytics", label: "Analytics", segment: "analytics" },
    { key: "activity", label: "Activity", segment: "activity" },
    { key: "details", label: "Details", segment: "details" },
  ];

  const toggleArchive = async () => {
    const ok = await confirm({
      title: archived ? `Restore "${project.name}"?` : `Archive "${project.name}"?`,
      description: archived
        ? "It returns to the deal floor with its engagements intact."
        : "The project and its engagements drop off the deal floor. Nothing is destroyed — undo straight after, or restore from the archived filter.",
      confirmLabel: archived ? "Restore" : "Archive",
      tone: archived ? "default" : "destructive",
    });
    if (!ok) return;
    try {
      await archiveProject.mutateAsync({ id: project.id, archived });
      if (archived) {
        toast.success("Project restored");
      } else {
        toastUndo(`"${project.name}" archived`, () =>
          archiveProject.mutateAsync({ id: project.id, archived: true }),
        );
        router.push("/projects");
      }
    } catch {
      toast.error(`Failed to ${archived ? "restore" : "archive"} project`);
    }
  };

  // What the project is actually short of decides the primary action. An empty project
  // needs a book before it can need a company; a project with several books has to be
  // asked which one — filing into whichever happened to be first is how a buyer ends
  // up in the sell-side list.
  const primaryAction =
    engagements.length === 0 ? (
      <Button size="sm" onClick={() => setAddEngagementOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add engagement
      </Button>
    ) : engagements.length === 1 ? (
      <AddCompanyDialog
        mandateId={engagements[0].id}
        mandateName={engagements[0].name}
        mandateType={engagements[0].type}
        exchangeRate={null}
        trigger={
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Add company
          </Button>
        }
      />
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" />}>
          <Plus className="h-4 w-4" aria-hidden />
          Add company
          <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 w-72">
          {/* A bare label outside a group throws in Base UI and kills the whole menu. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className={LABEL}>Into which engagement</DropdownMenuLabel>
            {engagements.map((e) => (
              <DropdownMenuItem key={e.id} onClick={() => setAddCompanyFor(e)}>
                <span
                  className={cn(
                    "shrink-0 rounded-[3px] px-1 text-[10px] font-medium leading-4",
                    DEAL_TYPE_STYLE[e.type],
                  )}
                >
                  {DEAL_TYPE_SHORT[e.type]}
                </span>
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" style={MONO}>
                  {e.total_companies}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <ProjectShellProvider
      value={{
        project,
        engagements,
        archived,
        isPartner,
        openAddEngagement: () => setAddEngagementOpen(true),
        openEditProject: () => setEditOpen(true),
        openEditEngagement: (mandateId: number) => setEditEngagementId(mandateId),
        openTeam: () => setTeamOpen(true),
        openDelete: () => setDeleteOpen(true),
        openNewTask: (defaults?: Partial<TaskCreateInput>) =>
          setTaskDefaults({ title: "", project_id: project.id, ...defaults }),
      }}
    >
      <div className="flex flex-col gap-5">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4">
          {/* Breadcrumb — the project's place in the product, and the way back. */}
          <Breadcrumbs
            items={[
              { label: "Projects", href: "/projects" },
              { label: showClient ? project.client_name : project.name },
            ]}
          />

          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className={RECORD_TITLE} style={RECORD_TITLE_STYLE}>
                  {project.name}
                </h1>
                {archived && <span className={cn(CHIP, CHIP_TONE.warning)}>Archived</span>}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {showClient && (
                  <>
                    <span>{project.client_name}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                {sides.length > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1" aria-label="Deal sides">
                      {sides.map((s) => (
                        <span
                          key={s}
                          className={cn(
                            "rounded-[3px] px-1 text-[10px] font-medium leading-4",
                            DEAL_TYPE_STYLE[s],
                          )}
                        >
                          {DEAL_TYPE_SHORT[s]}
                        </span>
                      ))}
                    </span>
                    <span aria-hidden>·</span>
                  </>
                )}
                <span>
                  {headline.last_activity ? (
                    <>
                      Last outreach{" "}
                      <span className="tabular-nums" style={MONO}>
                        {fmtDate(headline.last_activity)}
                      </span>
                    </>
                  ) : (
                    "No outreach logged yet"
                  )}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {members.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTeamOpen(true)}
                  className="mr-1 flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
                  aria-label="Manage the project team"
                >
                  <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Team</span>
                  <AvatarGroup names={members} size="md" max={4} />
                </button>
              )}

              {primaryAction}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="icon-sm" aria-label="Project actions" />}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50 w-56">
                  <DropdownMenuItem onClick={() => setAddEngagementOpen(true)}>
                    <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Add
                    engagement
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTaskDefaults({ title: "", project_id: project.id })}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" aria-hidden /> Add task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTeamOpen(true)}>
                    <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> Manage team
                  </DropdownMenuItem>
                  {isPartner && (
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden /> Edit project
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {/* Not partner-gated: archiving is reversible in one click, and it is
                      the first of the two steps permanent delete requires — gating it
                      would make an analyst's own project undeletable by them. */}
                  <DropdownMenuItem onClick={toggleArchive}>
                    {archived ? (
                      <>
                        <ArchiveRestore className="h-4 w-4 text-muted-foreground" aria-hidden />{" "}
                        Restore project
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 text-muted-foreground" aria-hidden /> Archive
                        project
                      </>
                    )}
                  </DropdownMenuItem>
                  {/* Only on an archived project. The server refuses with a 409 either
                      way; hiding it keeps delete out of the ordinary flow. */}
                  {archived && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                        <span className="font-medium">Delete permanently</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* An archived project is still readable, so the state has to be stated where
              the work would start — not left to a small tag beside the title. */}
          {archived && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-soft px-4 py-2.5 ring-1 ring-inset ring-warning-line"
            >
              <p className="text-sm">
                <span className="font-medium text-warning-ink">This project is archived.</span>{" "}
                <span className="text-foreground">
                  It is off the deal floor. Nothing in it has been deleted.
                </span>
              </p>
              <Button size="sm" onClick={toggleArchive}>
                <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                Restore project
              </Button>
            </div>
          )}

          <MetricRail metrics={metrics} className={PANEL} />

          <ProjectNav projectId={projectId} tabs={tabs} />
        </header>

        {/* ── The view ───────────────────────────────────────────────────── */}
        {children}
      </div>

      {/* ── Dialogs, mounted once for every view ─────────────────────────── */}
      {addEngagementOpen && (
        <MandateDialog
          projectId={project.id}
          defaultClientName={project.client_name}
          open
          onOpenChange={setAddEngagementOpen}
          trigger={null}
        />
      )}
      {addCompanyFor && (
        <AddCompanyDialog
          key={addCompanyFor.id}
          mandateId={addCompanyFor.id}
          mandateName={addCompanyFor.name}
          mandateType={addCompanyFor.type}
          exchangeRate={null}
          open
          onOpenChange={(o) => !o && setAddCompanyFor(null)}
        />
      )}
      {editOpen && (
        <EditProjectDialog
          projectId={project.id}
          currentName={project.name}
          currentClientName={project.client_name}
          open
          onOpenChange={setEditOpen}
        />
      )}
      {teamOpen && <TeamDialog projectId={project.id} open onOpenChange={setTeamOpen} />}
      {editEngagementId !== null && editingMandate && (
        <MandateDialog
          mandate={editingMandate}
          open
          onOpenChange={(o) => !o && setEditEngagementId(null)}
          trigger={null}
        />
      )}
      <TaskDialog
        open={taskDefaults !== null}
        onOpenChange={(o) => !o && setTaskDefaults(null)}
        defaults={taskDefaults ?? { title: "", project_id: project.id }}
      />
      <DeleteProjectDialog
        projectId={project.id}
        projectName={project.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/projects")}
      />
    </ProjectShellProvider>
  );
}

function ProjectShellSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading project">
      <div className="h-3 w-40 animate-pulse rounded bg-ink-100" />
      <div className="h-8 w-72 animate-pulse rounded-md bg-ink-100" />
      <div className="h-[62px] animate-pulse rounded-lg bg-ink-100" />
      <div className="h-9 w-full animate-pulse rounded bg-ink-100" />
      <div className="h-64 animate-pulse rounded-lg bg-ink-100" />
    </div>
  );
}
