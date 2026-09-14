"use client";

/**
 * Project details — the record behind the workspace, and where it is configured.
 *
 * Grouped sections rather than one long form, and each section edits through the control
 * that already owns that thing: the project's own fields through the shell's edit dialog
 * (partner-only, server-enforced), the team through the membership panel, an engagement
 * through the engagement dialog. Nothing here re-implements a mutation, so nothing here
 * can drift from the rules those mutations enforce.
 *
 * The vocabulary sections are deliberately read-only with a pointer to Settings: a
 * category or a data source is *firm* configuration, shared by every project, and the
 * fastest way to make a firm's vocabulary incoherent is to let one project edit it in
 * passing.
 */

import { use } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Pencil,
  Settings,
  Users,
} from "lucide-react";

import { ProjectMembers } from "@/components/features/project-members";
import { useProjectShell } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/use-categories";
import {
  AWAITING_INK,
  DEAL_TYPE_LABEL,
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  INK_LINK,
  LABEL,
  MONO,
  PANEL,
  PANEL_TITLE,
} from "@/lib/design";
import { fmtDateFull } from "@/lib/format";
import { parseServerDate } from "@/lib/format";
import { SIDE_ORDER } from "@/lib/project";
import { cn } from "@/lib/utils";
import { condition, workspaceHref } from "@/lib/project-views";

const MANDATE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
  TERMINATED: "Terminated",
};

export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);
  const {
    project,
    engagements,
    archived,
    isPartner,
    openEditProject,
    openEditEngagement,
    openAddEngagement,
  } = useProjectShell();

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.items ?? [];

  // `created_at` / `updated_at` are naive UTC from the API — parseServerDate is what
  // stops them rendering hours off in IST.
  const created = parseServerDate(project.created_at);
  const updated = parseServerDate(project.updated_at);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Project information ─────────────────────────────────────────── */}
      <section className={cn(PANEL, "p-4 lg:col-span-2")}>
        <header className="flex items-start justify-between gap-2">
          <div>
            <h2 className={PANEL_TITLE}>Project information</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The record the whole workspace hangs off.
            </p>
          </div>
          {isPartner && (
            <Button size="sm" variant="outline" onClick={openEditProject}>
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
          )}
        </header>

        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Project name" value={project.name} />
          <Field label="Client" value={project.client_name} />
          <Field
            label="Status"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("hb", archived ? "hb-0" : "hb-100")} aria-hidden />
                {archived ? "Archived" : "Active"}
              </span>
            }
          />
          <Field
            label="Engagements"
            value={
              <span className="tabular-nums" style={MONO}>
                {engagements.length}
              </span>
            }
          />
          <Field
            label="Opened"
            value={
              <span title={created.toLocaleString()}>{fmtDateFull(project.created_at)}</span>
            }
          />
          <Field
            label="Last edited"
            value={
              <span title={updated.toLocaleString()}>{fmtDateFull(project.updated_at)}</span>
            }
          />
          <Field
            label="Last outreach"
            value={
              project.headline.last_activity
                ? fmtDateFull(project.headline.last_activity)
                : "—"
            }
          />
          <Field
            label="Companies"
            value={
              <span className="tabular-nums" style={MONO}>
                {project.headline.total_companies}
              </span>
            }
          />
        </dl>

        {!isPartner && (
          <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
            Renaming a project is a partner action — the server enforces it, so this panel
            simply does not offer it.
          </p>
        )}
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <section className={cn(PANEL, "p-4")}>
        <h2 className={cn(PANEL_TITLE, "flex items-center gap-1.5")}>
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
          Team
        </h2>
        <div className="mt-3">
          <ProjectMembers projectId={projectId} />
        </div>
      </section>

      {/* ── Engagements ──────────────────────────────────────────────────── */}
      <section className={cn(PANEL, "lg:col-span-2")}>
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className={cn(PANEL_TITLE, "flex items-center gap-1.5")}>
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              Engagements
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              One book per engagement, grouped by which side of the deal it works.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openAddEngagement}>
            Add
          </Button>
        </header>

        {engagements.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No engagements yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {SIDE_ORDER.map((side) => {
              const rows = engagements.filter((e) => e.type === side);
              if (rows.length === 0) return null;
              return (
                <div key={side} className="px-4 py-3">
                  <p className={cn(LABEL, "mb-2")}>{DEAL_TYPE_LABEL[side]}</p>
                  <ul className="flex flex-col gap-2">
                    {rows.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-[3px] px-1 text-[10px] font-medium leading-4",
                            DEAL_TYPE_STYLE[e.type],
                          )}
                        >
                          {DEAL_TYPE_SHORT[e.type]}
                        </span>
                        <Link
                          href={workspaceHref(projectId, { filter: condition("engagement", "any_of", [e.id]) })}
                          className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
                        >
                          {e.name}
                        </Link>
                        <span className="text-[11px] text-muted-foreground">
                          {MANDATE_STATUS_LABEL[e.status] ?? e.status}
                        </span>
                        <span
                          className="text-[11px] tabular-nums text-muted-foreground"
                          style={MONO}
                        >
                          {e.total_companies}{" "}
                          {e.total_companies === 1 ? "company" : "companies"}
                          {e.overdue_count > 0 && (
                            <span className="font-semibold text-foreground">
                              {" "}
                              · {e.overdue_count} late
                            </span>
                          )}
                          {e.needs_initial_count > 0 && (
                            <span className={AWAITING_INK}>
                              {" "}
                              · {e.needs_initial_count} intro pending
                            </span>
                          )}
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-2">
                          {(e.analysts ?? []).length > 0 && (
                            <span className="hidden text-[11px] text-muted-foreground sm:inline">
                              {(e.analysts ?? []).map((a) => a.full_name).join(", ")}
                            </span>
                          )}
                          {isPartner && (
                            <button
                              type="button"
                              onClick={() => openEditEngagement(e.id)}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label={`Edit ${e.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Firm configuration this project uses ─────────────────────────── */}
      <section className={cn(PANEL, "p-4")}>
        <h2 className={cn(PANEL_TITLE, "flex items-center gap-1.5")}>
          <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
          Configuration
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Shared across every project in the firm — changed in Settings, never here.
        </p>

        <div className="mt-4">
          <p className={cn(LABEL, "mb-1.5")}>Categories</p>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">None defined yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <p className={cn(LABEL, "mb-1.5")}>Bands</p>
          <p className="text-xs text-muted-foreground">
            Bands are the analyst&rsquo;s own segmentation and are defined per engagement,
            not per firm — you set them up inside the book they belong to.
          </p>
        </div>

        <Link
          href="/settings"
          className={cn(INK_LINK, "mt-4 inline-flex items-center gap-1 text-xs")}
        >
          Open Settings
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </section>

      {/* ── Dates ────────────────────────────────────────────────────────── */}
      <section className={cn(PANEL, "p-4 lg:col-span-3")}>
        <h2 className={cn(PANEL_TITLE, "flex items-center gap-1.5")}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          Dates
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cadence dates are computed against IST today and are never stored — these are
          the record&rsquo;s own timestamps.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <Field label="Opened" value={fmtDateFull(project.created_at)} />
          <Field label="Last edited" value={fmtDateFull(project.updated_at)} />
          <Field
            label="Archived"
            value={project.archived_at ? fmtDateFull(project.archived_at) : "—"}
          />
        </dl>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1 truncate text-sm text-foreground">{value}</dd>
    </div>
  );
}
