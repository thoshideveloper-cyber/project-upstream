"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
import { useProjects } from "@/hooks/use-projects";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryManager } from "@/components/features/category-manager";
import { EmailSendingCard, EmailTemplatesCard } from "@/components/features/email-sending-card";
import { StageManager } from "@/components/features/stage-manager";
import { DataSourceManager } from "@/components/features/data-source-manager";
import { WorkspaceCard } from "@/components/features/workspace-card";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PANEL, PANEL_HEAD, PANEL_TITLE } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * Settings, as an index and a column.
 *
 * Ten configuration panels stacked in one long scroll made "where is the stage list"
 * a hunt. The index on the left names every section and marks the one on screen; each
 * section keeps its own anchor, so a link can point straight at "#team".
 */
const SECTIONS = [
  { id: "firm", label: "Firm" },
  { id: "cadence", label: "Cadence" },
  { id: "workspace", label: "Workspace data" },
  { id: "email", label: "Email sending" },
  { id: "templates", label: "Email templates" },
  { id: "categories", label: "Categories" },
  { id: "stages", label: "Funnel stages" },
  { id: "sources", label: "Data sources" },
  { id: "team", label: "Team" },
  { id: "access", label: "Project access" },
] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{value}</dd>
    </div>
  );
}

/** A plain settings panel: title and one line of purpose on a hairline, then the body. */
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(PANEL, "overflow-hidden")}>
      <div className={cn(PANEL_HEAD, "flex-col items-start gap-0.5 py-3")}>
        <h2 className={PANEL_TITLE}>{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Which section is on screen — the index follows the scroll. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0]);
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const active = useActiveSection(SECTIONS.map((s) => s.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="How the firm works in Upstream: people, cadence, email, and the vocabulary every book shares."
      />

      <div className="grid gap-8 lg:grid-cols-[184px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-0 space-y-px">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "true" : undefined}
                  className={cn(
                    "flex h-8 items-center rounded-md px-2.5 text-sm transition-colors",
                    active === s.id
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 max-w-4xl flex-col gap-6">
          <section id="firm" className="scroll-mt-6">
            <Panel title="Firm" description="The workspace you are signed in to.">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Field label="Firm" value={user?.firm.name ?? "—"} />
                <Field
                  label="Your role"
                  value={
                    <Badge variant="outline" className="capitalize">
                      {user?.role.toLowerCase()}
                    </Badge>
                  }
                />
                <Field label="Signed in as" value={user?.full_name ?? "—"} />
                <Field label="Email" value={user?.email ?? "—"} />
              </dl>
            </Panel>
          </section>

          <section id="cadence" className="scroll-mt-6">
            <Panel
              title="Cadence"
              description="How the follow-up schedule is computed. The clock starts when the first email is logged."
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="Default interval" value="14 days (bi-weekly)" />
                <Field label="Anchor" value="Fixed to the initial email date" />
                <Field label="Timezone" value="Asia/Kolkata (IST)" />
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                The interval is configurable per company on its cadence tab.
              </p>
            </Panel>
          </section>

          <section id="workspace" className="scroll-mt-6">
            <WorkspaceCard />
          </section>

          <section id="email" className="scroll-mt-6">
            <EmailSendingCard />
          </section>

          <section id="templates" className="scroll-mt-6">
            <EmailTemplatesCard />
          </section>

          <section id="categories" className="scroll-mt-6">
            <CategoryManager />
          </section>

          <section id="stages" className="scroll-mt-6">
            <StageManager />
          </section>

          <section id="sources" className="scroll-mt-6">
            <DataSourceManager />
          </section>

          <section id="team" className="scroll-mt-6">
            <Panel
              title={`Team · ${users?.items.length ?? 0}`}
              description="Everyone with an account in this firm."
            >
              {!users || users.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members.</p>
              ) : (
                <ul className="-my-2 divide-y divide-border">
                  {users.items.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <Avatar name={u.full_name} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{u.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      </span>
                      <Badge variant={u.role === "PARTNER" ? "default" : "outline"} className="capitalize">
                        {u.role.toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          <section id="access" className="scroll-mt-6">
            <ProjectAccessCard />
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Who can reach which project — read-only.
 *
 * Membership is granted in the project's own Team view, where the person doing it can
 * see what they are granting access *to*. This is the roll-up: the one place a partner
 * can scan the whole firm's access at once and notice that nobody is on a live project,
 * or that someone who left is still on four.
 */
function ProjectAccessCard() {
  const { data } = useProjects(false);
  const projects = data?.items ?? [];

  return (
    <Panel
      title={`Project access · ${projects.length}`}
      description="Read-only. Add or remove members from a project's Team view, where the access being granted is visible beside the person getting it."
    >
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active projects.</p>
      ) : (
        <ul className="-my-2 divide-y divide-border">
          {projects.map((p) => {
            const names = p.members?.length ? p.members.map((m) => m.full_name) : (p.team ?? []);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link
                  href={`/projects/${p.id}/details`}
                  className="min-w-0 flex-1 text-sm underline-offset-4 hover:underline"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.client_name}</span>
                </Link>
                {names.length === 0 ? (
                  <span className="shrink-0 text-xs text-warning-ink">Nobody assigned</span>
                ) : (
                  <AvatarGroup names={names} max={5} size="sm" label="Project team" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
