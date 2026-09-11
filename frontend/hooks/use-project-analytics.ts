"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  CategoryRow,
  EngagementRow,
  LayerRow,
  OverviewStats,
  ReplyTiming,
  TimeseriesPoint,
} from "@/hooks/use-analytics";

/**
 * One project's analytics, in one request.
 *
 * Six panels, six figures that must agree, and a single server call that computes all of
 * them from the same scoped mandate set — six separate endpoint calls would each pick
 * their own moment to be stale, and a page whose reply rate disagrees with its own funnel
 * is worse than a page with no funnel.
 *
 * The row types are imported from `use-analytics` rather than redeclared: these are
 * literally the same service functions the firm-wide page calls, narrowed to a project,
 * so a second definition here could only ever drift from the first.
 */
export interface ProjectAnalytics {
  overview: OverviewStats;
  timeseries: TimeseriesPoint[];
  by_engagement: EngagementRow[];
  by_category: CategoryRow[];
  by_layer: LayerRow[];
  reply_timing: ReplyTiming;
  weeks: number;
}

export function useProjectAnalytics(projectId: number, weeks = 12) {
  return useQuery<ProjectAnalytics>({
    queryKey: ["project-analytics", projectId, weeks],
    queryFn: () =>
      api.get<ProjectAnalytics>(`/projects/${projectId}/analytics?weeks=${weeks}`),
    enabled: projectId > 0,
    staleTime: 60_000,
  });
}
