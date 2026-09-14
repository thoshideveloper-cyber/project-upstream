"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { Activity as ActivityIcon } from "lucide-react";

import { PanelEmpty, PanelError } from "@/components/analytics/states";
import { Avatar } from "@/components/ui/avatar";
import { ACTIVITY_TONE, LABEL } from "@/lib/design";
import {
  actorName,
  countByGroup,
  groupByDay,
  linkFor,
  phraseFor,
  verbMeta,
  VERB_GROUPS,
  type ActivityGroup,
} from "@/lib/activity";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types";

const MONO = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * The trail, read as sentences.
 *
 *     Rhea Kapoor  logged an initial email  ·  Acme Industries          4h
 *
 * Grouped by day, because "when" in a feed means "which day", and a column of exact
 * timestamps is noise you have to subtract before you can read anything.
 *
 * Filtering is client-side over the loaded page rather than a refetch: the chips carry
 * counts, and counts that change when you click one of them are counts nobody trusts.
 * A caller that wants server-side filtering passes `group` down to the hook instead.
 */
export function ActivityFeed({
  events,
  isLoading,
  isError,
  onRetry,
  emptyLine = "Nothing has happened here yet.",
  showFilters = true,
  compact = false,
  className,
}: {
  events: ActivityEvent[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyLine?: string;
  showFilters?: boolean;
  /** Drops the day headers and the filter chips — for a dashboard panel. */
  compact?: boolean;
  className?: string;
}) {
  const [group, setGroup] = useState<ActivityGroup | null>(null);

  const counts = useMemo(() => countByGroup(events), [events]);
  const filtered = useMemo(
    () => (group ? events.filter((e) => verbMeta(e.verb).group === group) : events),
    [events, group],
  );
  const days = useMemo(() => groupByDay(filtered), [filtered]);

  if (isError) return <PanelError label="activity" onRetry={onRetry} />;

  if (isLoading) {
    return (
      <ul className={cn("space-y-3", className)}>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="size-6 shrink-0 rounded-full bg-muted/60" />
            <span className="h-3 flex-1 rounded bg-muted/50" />
          </li>
        ))}
      </ul>
    );
  }

  if (events.length === 0) {
    return (
      <PanelEmpty
        icon={<ActivityIcon className="size-5 text-muted-foreground" />}
        line={emptyLine}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showFilters && !compact && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            label="All"
            count={events.length}
            active={group === null}
            onClick={() => setGroup(null)}
          />
          {VERB_GROUPS.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              count={counts[key]}
              active={group === key}
              onClick={() => setGroup(group === key ? null : key)}
              // A filter that can only ever produce an empty list is not a choice.
              disabled={counts[key] === 0}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nothing in this group.
        </p>
      ) : compact ? (
        <ul className="space-y-2.5">
          {filtered.map((e) => (
            <Row key={e.id} event={e} />
          ))}
        </ul>
      ) : (
        days.map((day) => (
          <section key={day.key} className="space-y-2">
            <p className={cn(LABEL, "sticky top-0 z-10 bg-background/95 py-1")}>
              {day.label}
            </p>
            <ul className="space-y-2.5">
              {day.events.map((e) => (
                <Row key={e.id} event={e} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
  disabled,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
        active
          ? "border-border-strong bg-accent text-primary-ink"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70" style={MONO}>
        {count}
      </span>
    </button>
  );
}

function Row({ event }: { event: ActivityEvent }) {
  const meta = verbMeta(event.verb);
  const href = linkFor(event);
  const name = actorName(event);

  // The icon set is resolved by name so `lib/activity.ts` can stay React-free. An
  // unrecognised name falls back rather than crashing the whole feed.
  const Icon =
    (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? ActivityIcon;

  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="relative shrink-0">
        <Avatar name={name} size="sm" />
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -right-0.5 inline-flex size-3.5 items-center justify-center rounded-full ring-2 ring-background",
            ACTIVITY_TONE[meta.tone],
          )}
        >
          <Icon className="size-2" />
        </span>
      </span>

      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-medium">{name}</span>{" "}
        <span className="text-muted-foreground">{phraseFor(event)}</span>
        {event.object_label && (
          <>
            <span className="text-muted-foreground"> · </span>
            {href ? (
              <Link href={href} className="hover:text-primary-ink hover:underline">
                {event.object_label}
              </Link>
            ) : (
              // A deleted project links nowhere: a 404 is a worse answer than no link.
              <span className="text-muted-foreground line-through">
                {event.object_label}
              </span>
            )}
          </>
        )}
      </p>

      <time
        dateTime={event.created_at}
        title={new Date(event.created_at).toLocaleString()}
        className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
        style={MONO}
      >
        {relativeTime(event.created_at)}
      </time>
    </li>
  );
}
