"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  useAssignProjectMember,
  useProjectMembers,
  useUnassignProjectMember,
} from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { LABEL, MEMBER_SOURCE_META } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { ProjectMember } from "@/types";

/**
 * Who is on this project, and how.
 *
 * The `source` badge is the point. Only `assigned` is a grant a partner made here, and
 * only `assigned` can be revoked here — someone who reaches the project through an
 * engagement is removed by unassigning them from that engagement, not from this list.
 * Showing the union rather than just the new table is what stops every existing project
 * looking like it has no team on the day this ships.
 *
 * A project assignment grants access to the **project** — its tasks, its activity, its
 * shell — and deliberately not to its engagements' companies. The footnote says so,
 * because a partner adding someone here will otherwise assume it did more than it did.
 */
export function ProjectMembers({ projectId }: { projectId: number }) {
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";
  const { data, isLoading } = useProjectMembers(projectId);
  const { data: users } = useUsers();
  const assign = useAssignProjectMember(projectId);
  const unassign = useUnassignProjectMember(projectId);
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);

  const members = data?.items ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = (users?.items ?? []).filter((u) => !memberIds.has(u.id));

  const remove = async (member: ProjectMember) => {
    const ok = await confirm({
      title: `Remove ${member.full_name} from this project?`,
      description:
        "They lose access to the project, its tasks and its activity. Any engagement they are assigned to is untouched, and so is the work they logged.",
      confirmLabel: "Remove",
      tone: "destructive",
    });
    if (!ok) return;
    unassign.mutate(member.id, {
      onSuccess: () => toast.success(`${member.full_name} removed`),
      onError: (e: unknown) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className={LABEL}>Team</p>
        {isPartner && candidates.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAdding((v) => !v)}
          >
            <UserPlus className="mr-1.5 size-3.5" aria-hidden />
            {adding ? "Close" : "Add member"}
          </Button>
        )}
      </div>

      {isPartner && adding && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/20 p-2">
          {candidates.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={assign.isPending}
              onClick={() =>
                assign.mutate(u.id, {
                  onSuccess: () => {
                    toast.success(`${u.full_name} added`);
                    setAdding(false);
                  },
                  onError: (e: unknown) => toast.error((e as Error).message),
                })
              }
              className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs shadow-xs hover:bg-accent"
            >
              <Avatar name={u.full_name} size="xs" />
              {u.full_name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <ul className="space-y-2">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-8 rounded-full bg-muted/60" />
              <span className="h-3 w-32 rounded bg-muted/50" />
            </li>
          ))}
        </ul>
      ) : members.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">
          Nobody is on this project yet.
        </p>
      ) : (
        <ul className="divide-y">
          {members.map((m) => {
            const meta = MEMBER_SOURCE_META[m.source];
            return (
              <li key={m.id} className="flex items-center gap-2.5 py-2">
                <Avatar name={m.full_name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.full_name}</p>
                  {m.email && (
                    <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                  )}
                </div>
                <span
                  title={meta.hint}
                  className={cn(
                    "shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[11px]",
                    m.source === "assigned"
                      ? "border-border-strong bg-subtle text-primary-ink"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {meta.label}
                </span>
                {isPartner && m.sources?.includes("assigned") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={`Remove ${m.full_name}`}
                    onClick={() => remove(m)}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Adding someone here gives them the project — its tasks and its activity. It does
        not give them the engagements&rsquo; companies; assign them to an engagement for
        that.
      </p>
    </div>
  );
}
