"use client";

/**
 * The project shell's context.
 *
 * Every view of a project needs the same handful of things — the project itself, the
 * flattened engagement list, and the ability to open the shell's dialogs — and each of
 * those dialogs must be mounted exactly once, in the layout, not once per page. A page
 * that mounted its own "add engagement" dialog would unmount it on navigation, and a
 * page that re-fetched the project would show a different company count from the header
 * two seconds after the header settled.
 *
 * So: the layout owns the data and the dialogs, pages read this.
 */

import { createContext, useContext } from "react";

import type { MandateEngagementStats, ProjectDetail, TaskCreateInput } from "@/types";

export interface ProjectShell {
  project: ProjectDetail;
  /** Every engagement in the project, flattened in side order. */
  engagements: MandateEngagementStats[];
  archived: boolean;
  isPartner: boolean;
  openAddEngagement: () => void;
  openEditProject: () => void;
  openEditEngagement: (mandateId: number) => void;
  openTeam: () => void;
  openDelete: () => void;
  /** Defaults pre-attach the task to a project / engagement / company. */
  openNewTask: (defaults?: Partial<TaskCreateInput>) => void;
}

const Ctx = createContext<ProjectShell | null>(null);

export const ProjectShellProvider = Ctx.Provider;

/**
 * Throws rather than returning null: every consumer lives under the project layout by
 * construction, and a silent null here would surface as a blank panel three components
 * away from the mistake.
 */
export function useProjectShell(): ProjectShell {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useProjectShell must be used inside the project layout");
  }
  return ctx;
}
