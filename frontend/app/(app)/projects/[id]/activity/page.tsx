"use client";

/**
 * Project history — the append-only trail, read as sentences.
 *
 * The activity log is written by the code that performs each mutation, inside that
 * mutation's own transaction (CLAUDE.md: never a POST). So this page is a pure read, and
 * everything it can show is something that actually happened.
 *
 * Two deliberate choices about *what* it shows:
 *
 *   • Filtering is server-side, by verb group, so a chip's count is the whole trail's
 *     count and not "of the page I happened to load". The old inline feed filtered the
 *     loaded page client-side, which is right for a dashboard panel and wrong for a
 *     history you scroll.
 *   • The vocabulary is the product's four groups (Deal, Outreach, Data, People), not a
 *     list of raw verbs. A filter per verb would be twenty-eight chips nobody reads.
 *
 * Insignificant technical events never reach here because they are never logged: the
 * write side is an explicit `services.activity.log(...)` call at each mutation site, and
 * a guard test makes adding a mutating route without a decision fail CI.
 */

import { use } from "react";
import { Activity as ActivityIcon } from "lucide-react";

import { ActivityFeed } from "@/components/features/activity-feed";
import { PanelError } from "@/components/analytics/states";
import { useProjectShell } from "@/components/project/project-context";
import { useProjectActivity } from "@/hooks/use-activity";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import { VERB_GROUPS, type ActivityGroup } from "@/lib/activity";
import { MONO, PANEL, PANEL_TITLE, SEG_GROUP, SEG_ITEM, SEG_ITEM_OFF, SEG_ITEM_ON } from "@/lib/design";
import { enumParam, type ParamSpec } from "@/lib/table-url-state";
import { cn } from "@/lib/utils";

/** MODULE SCOPE — see the note in `project-workspace.tsx`. */
const ACTIVITY_SPEC = {
  group: enumParam(["", "DEAL", "OUTREACH", "DATA", "PEOPLE"] as const, ""),
} satisfies ParamSpec;

export default function ProjectActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);
  const { project } = useProjectShell();

  const [urlState, patchUrl] = useTableUrlState(ACTIVITY_SPEC);
  const group = urlState.group as ActivityGroup | "";

  const { data, isLoading, isError, refetch } = useProjectActivity(
    projectId,
    group || undefined,
  );
  // The unfiltered trail, so the "All" chip carries a count that does not move when a
  // filter is applied.
  const { data: allData } = useProjectActivity(projectId);

  const events = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={cn(PANEL, "lg:col-span-2")}>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className={PANEL_TITLE}>History</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Everything that has happened on {project.name}, newest first.
            </p>
          </div>
          {total > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground" style={MONO}>
              {events.length} of {total}
            </span>
          )}
        </header>

        {/* Server-side group filter. Rendered as its own row rather than inside the
            feed, because the feed's own chips filter what is already loaded. One group
            at a time, so it is a segmented control, not a row of toggles. */}
        <div
          className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5"
          role="group"
          aria-label="Filter the history by kind"
        >
          <div className={SEG_GROUP}>
          <GroupChip
            label="All"
            count={allData?.total}
            active={group === ""}
            onClick={() => patchUrl({ group: "" })}
          />
          {VERB_GROUPS.map((g) => (
            <GroupChip
              key={g.key}
              label={g.label}
              active={group === g.key}
              onClick={() => patchUrl({ group: group === g.key ? "" : g.key })}
            />
          ))}
          </div>
        </div>

        <div className="p-4">
          {isError ? (
            <PanelError label="this project's history" onRetry={() => refetch()} />
          ) : (
            <ActivityFeed
              events={events}
              isLoading={isLoading}
              // The chips above already filter, server-side. A second set inside the
              // feed would filter the filter.
              showFilters={false}
              emptyLine={
                group
                  ? "Nothing in this group yet."
                  : "Nothing has been logged on this project yet."
              }
            />
          )}
        </div>
      </section>

      {/* ── What the trail is, and is not ───────────────────────────────── */}
      <aside className={cn(PANEL, "h-fit p-4")}>
        <h2 className={cn(PANEL_TITLE, "flex items-center gap-1.5")}>
          <ActivityIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
          About this trail
        </h2>
        <dl className="mt-3 flex flex-col gap-3 text-xs">
          <div>
            <dt className="font-medium text-foreground">Append-only</dt>
            <dd className="mt-0.5 text-muted-foreground">
              Rows are written by the change itself, in the same transaction. Nothing here
              can be edited or removed to tidy up a history.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Names are snapshots</dt>
            <dd className="mt-0.5 text-muted-foreground">
              A company renamed after an event keeps the name it had at the time — which
              is what makes an old row still readable.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Outreach lives here too</dt>
            <dd className="mt-0.5 text-muted-foreground">
              Every logged touch appears in the Outreach group. The cadence it drives is
              computed from those same events, never stored.
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function GroupChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(SEG_ITEM, active ? SEG_ITEM_ON : SEG_ITEM_OFF)}
    >
      {label}
      {count != null && (
        <span className="tabular-nums text-muted-foreground" style={MONO}>
          {count}
        </span>
      )}
    </button>
  );
}
