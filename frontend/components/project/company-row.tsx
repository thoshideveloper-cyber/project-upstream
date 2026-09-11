"use client";

/**
 * A company's cadence and actions, as the workspace register renders them.
 *
 * Carried over in behaviour from the old book grid so nothing an analyst could do from
 * a book row was lost: the cadence still speaks the register's language, the primary
 * action is still contextual ("Send intro" before the clock starts, "Follow-up" after),
 * the quick outcomes are still one menu away, and a task filed from a row still
 * pre-attaches to the company so the server can derive its engagement and project.
 */

import { useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  ChevronDown,
  FolderOpen,
  MoreHorizontal,
  PhoneCall,
  Reply,
  Users,
  XCircle,
} from "lucide-react";

import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { TaskDialog } from "@/components/features/task-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtDate } from "@/lib/format";
import { AWAITING_DOT, AWAITING_INK, DUE_TOKEN, LATE_TOKEN, MONO } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { Company } from "@/types";

/* ── Next touch — the cadence, spoken in the register's language ───────────── */

/**
 * Every value here is server-computed (CLAUDE.md rule 2) — this only chooses how loud
 * to say it. Late is the red token; due inside a week is amber; further out is a grey
 * date; an intro that has not gone out carries the dashed glyph, because nothing about
 * it has started yet.
 */
export function NextTouch({ c }: { c: Company }) {
  const days = c.days_remaining;

  if (c.is_cold) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={`Follow-up cap reached after ${c.cycle_number ?? 1} cycle(s)`}
      >
        Cold
      </span>
    );
  }
  if (c.schedule_status === "AWAITING_INITIAL") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-xs", AWAITING_INK)}
        title="Awaiting the first email — the clock hasn't started"
      >
        <span className={AWAITING_DOT} aria-hidden />
        Intro pending
      </span>
    );
  }
  if (c.is_overdue) {
    return (
      <span
        className={LATE_TOKEN}
        style={MONO}
        title={c.next_due_date ? `Was due ${fmtDate(c.next_due_date)}` : undefined}
      >
        {Math.abs(days ?? 0)}d late
      </span>
    );
  }
  if (c.schedule_status === "ACTIVE" && days != null && days <= 7) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs"
        style={MONO}
        title={days === 0 ? "Due today" : `Due in ${days} days`}
      >
        <span className={DUE_TOKEN}>{days === 0 ? "Today" : `${days}d`}</span>
        <span className="text-muted-foreground">{fmtDate(c.next_due_date)}</span>
      </span>
    );
  }
  if (c.schedule_status === "ACTIVE" && c.next_due_date) {
    return (
      <span
        className="text-xs text-muted-foreground"
        style={MONO}
        title={days != null ? `Due in ${days} days` : undefined}
      >
        {fmtDate(c.next_due_date)}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground" style={MONO} title="Cadence stopped">
      —
    </span>
  );
}

/* ── Row actions — contextual primary + quick outcomes, quiet until hover ──── */

export function RowActions({ company }: { company: Company }) {
  const awaiting = company.schedule_status === "AWAITING_INITIAL";
  const running = !company.is_cold && (company.schedule_status === "ACTIVE" || awaiting);
  const [quickType, setQuickType] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);

  // Pre-attached to this company: the server derives the engagement and the project
  // from it, so "remember to call them back" filed from the row lands where the work is.
  const taskDialog = (
    <TaskDialog
      open={taskOpen}
      onOpenChange={setTaskOpen}
      defaults={{ title: "", company_id: company.id }}
    />
  );

  if (!running) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label={`Actions for ${company.company_name}`}
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 w-44">
          <DropdownMenuItem onClick={() => setTaskOpen(true)}>
            <CheckSquare className="h-4 w-4 text-muted-foreground" aria-hidden /> Add task
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/companies/${company.id}`} />}>
            <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden /> Open dossier
          </DropdownMenuItem>
        </DropdownMenuContent>
        {taskDialog}
      </DropdownMenu>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-end">
      <LogOutreachDialog
        companyId={company.id}
        companyName={company.company_name}
        defaultEventType={awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP"}
        trigger={
          <Button
            size="sm"
            variant="outline"
            // Inverts on row hover: the one filled control on the row the pointer is on,
            // so the next action is never a hunt, and never filled on the other forty.
            className="h-7 rounded-r-none pr-2.5 text-xs font-normal transition-colors group-hover:border-foreground group-hover:bg-foreground group-hover:text-background"
            data-testid={`log-touch-${company.id}`}
          >
            {awaiting ? "Send intro" : "Follow-up"}
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="outline"
              className="-ml-px h-7 w-6 rounded-l-none px-0 transition-colors group-hover:border-foreground"
              aria-label={`More outcomes for ${company.company_name}`}
            />
          }
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 w-44">
          <DropdownMenuItem onClick={() => setQuickType("RESPONSE")}>
            <Reply className="h-4 w-4 text-foreground" aria-hidden /> Mark replied
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickType("BOUNCE")}>
            <XCircle className="h-4 w-4 text-foreground" aria-hidden /> Mark bounced
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setQuickType("CALL")}>
            <PhoneCall className="h-4 w-4 text-muted-foreground" aria-hidden /> Log call
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickType("MEETING")}>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> Log meeting
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTaskOpen(true)}>
            <CheckSquare className="h-4 w-4 text-muted-foreground" aria-hidden /> Add task
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/companies/${company.id}`} />}>
            <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden /> Open dossier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {taskDialog}
      {quickType !== null && (
        <LogOutreachDialog
          key={quickType}
          companyId={company.id}
          companyName={company.company_name}
          defaultEventType={quickType}
          open
          onOpenChange={(o) => !o && setQuickType(null)}
          trigger={null}
        />
      )}
    </div>
  );
}
