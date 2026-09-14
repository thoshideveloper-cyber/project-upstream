"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MONO, PANEL } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * Today — the desk's state in one sentence and four ruled figures.
 *
 * It replaces a hero number and a pressure dial. Both said the same thing as the queue
 * count, louder, and neither could be acted on. What an analyst needs on arrival is the
 * verdict (is anything late), the four counts that decide the order of the day, and the
 * one button that starts it. Each figure opens the queue it counts.
 */

interface DeskBriefingProps {
  firmName?: string;
  analystName?: string;
  role?: string;
  overdue: number;
  dueToday: number;
  upcoming: number;
  needsInitial: number;
  dueThisWeek: number;
  isLoading?: boolean;
}

type Tone = "danger" | "warning" | "default";

const VALUE_TONE: Record<Tone, string> = {
  danger: "text-danger-ink",
  warning: "text-warning-ink",
  default: "text-foreground",
};

const DOT_TONE: Record<Tone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  default: "bg-ink-300",
};

function Figure({
  label,
  value,
  note,
  tone,
  href,
  isLoading,
}: {
  label: string;
  value: number;
  note: string;
  tone: Tone;
  href: string;
  isLoading?: boolean;
}) {
  const quiet = value === 0;
  return (
    <Link
      href={href}
      className="group/fig flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn("size-1.5 shrink-0 rounded-full", quiet ? "bg-ink-200" : DOT_TONE[tone])} aria-hidden />
        {label}
        <ArrowUpRight
          className="ml-auto size-3 text-ink-300 opacity-0 transition-opacity group-hover/fig:opacity-100"
          aria-hidden
        />
      </span>
      {isLoading ? (
        <span className="h-7 w-10 animate-pulse rounded bg-ink-100" />
      ) : (
        <span
          className={cn(
            "text-2xl font-semibold leading-8 tracking-[-0.01em]",
            quiet ? "text-muted-foreground" : VALUE_TONE[tone],
          )}
          style={MONO}
        >
          {value.toLocaleString()}
        </span>
      )}
      <span className="truncate text-xs text-muted-foreground">{note}</span>
    </Link>
  );
}

export function DeskBriefing({
  analystName,
  overdue,
  dueToday,
  upcoming,
  needsInitial,
  dueThisWeek,
  isLoading,
}: DeskBriefingProps) {
  const attention = overdue + dueToday;
  const firstName = analystName?.split(" ")[0];

  // The verdict, in one sentence — the number and the consequence together.
  const headline =
    overdue > 0 ? (
      <>
        <span className="text-danger-ink" style={MONO}>
          {overdue.toLocaleString()}
        </span>{" "}
        follow-up{overdue === 1 ? " has" : "s have"} slipped past due
        {dueToday > 0 && (
          <>
            , and{" "}
            <span className="text-warning-ink" style={MONO}>
              {dueToday}
            </span>{" "}
            {dueToday === 1 ? "is" : "are"} due today
          </>
        )}
        .
      </>
    ) : dueToday > 0 ? (
      <>
        <span className="text-warning-ink" style={MONO}>
          {dueToday}
        </span>{" "}
        follow-up{dueToday === 1 ? " is" : "s are"} due today. Nothing has slipped yet.
      </>
    ) : (
      <>Nothing is late and nothing is due today.</>
    );

  const sub =
    overdue > 0
      ? `Clear the oldest first${firstName ? `, ${firstName}` : ""} — each day late makes a reply less likely.`
      : dueToday > 0
        ? "Send them before they slip into the backlog."
        : dueThisWeek > 0
          ? `${dueThisWeek} follow-up${dueThisWeek === 1 ? "" : "s"} are queued later this week.`
          : "A quiet desk — a good day to source the next targets.";

  return (
    <section className={cn(PANEL, "overflow-hidden")} aria-label="Today" aria-busy={isLoading || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-6 text-foreground">{headline}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>
        </div>
        <Link href="/schedule">
          <Button variant={attention > 0 ? "default" : "outline"}>
            {attention > 0 ? "Work the queue" : "Open the queue"}
            <ArrowRight aria-hidden />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-border bg-border lg:grid-cols-4">
        <Figure
          label="Overdue"
          value={overdue}
          note={overdue > 0 ? "past their follow-up date" : "nothing has slipped"}
          tone="danger"
          href="/schedule"
          isLoading={isLoading}
        />
        <Figure
          label="Due today"
          value={dueToday}
          note="follow-ups to send today"
          tone="warning"
          href="/schedule"
          isLoading={isLoading}
        />
        <Figure
          label="Coming up"
          value={upcoming}
          note="queued on the cadence"
          tone="default"
          href="/schedule"
          isLoading={isLoading}
        />
        <Figure
          label="First outreach"
          value={needsInitial}
          note="intros not sent yet"
          tone="default"
          href="/schedule"
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
