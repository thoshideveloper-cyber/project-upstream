"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Ban, GripVertical, MoveRight } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { useConfirm } from "@/components/features/confirm-dialog";
import { useUpdateCompany } from "@/hooks/use-companies";
import { toastUndo } from "@/lib/undo-toast";
import {
  applyStatusMove,
  buildBoard,
  columnOf,
  legalTargets,
  planMove,
  PIPELINE_COLUMNS,
  type BoardMove,
  type PipelineColumnId,
} from "@/lib/pipeline-board";
import { cn } from "@/lib/utils";
import type { Company } from "@/types";

const MONO = { fontVariantNumeric: "tabular-nums" } as const;

export interface BoardRow {
  c: Company;
  projectName: string;
}

/** The cadence, in the register's language — same vocabulary as the Master List rows. */
function CadenceChip({ c }: { c: Company }) {
  if (c.schedule_status === "AWAITING_INITIAL")
    return (
      <span className="text-[11px] text-secondary-foreground" style={MONO}>
        intro pending
      </span>
    );
  if (c.is_overdue)
    return (
      <span className="text-[10px] font-semibold text-destructive-ink" style={MONO}>
        {Math.abs(c.days_remaining ?? 0)}d late
      </span>
    );
  if (c.schedule_status === "ACTIVE" && c.days_remaining != null)
    return (
      <span
        className={cn(
          "text-[10px]",
          c.days_remaining <= 7 ? "font-medium text-primary-ink" : "text-muted-foreground",
        )}
        style={MONO}
      >
        {c.days_remaining === 0 ? "due today" : `${c.days_remaining}d`}
      </span>
    );
  return (
    <span className="text-[10px] text-muted-foreground" style={MONO}>
      stopped
    </span>
  );
}

/**
 * The outreach pipeline as a board: one column per company status, a card per
 * company in your book.
 *
 * Dropping a card never writes the column. `planMove` (pure, unit-tested) turns a
 * drop into the thing it actually means — log the initial email, log a reply, flag
 * it by hand — or refuses it with a reason, because
 * NOT_CONTACTED/CONTACTED/RESPONDED/BOUNCED are derived from the append-only log
 * and the log wins (CLAUDE.md rules 1, 2, 4).
 *
 * Drag is never the only way through: every card carries a "Move to" menu with the
 * illegal destinations disabled, so the board is fully usable from the keyboard.
 */
export function PipelineBoard({ rows }: { rows: BoardRow[] }) {
  const confirm = useConfirm();
  const updateCompany = useUpdateCompany();

  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<PipelineColumnId | null>(null);
  /** Optimistic drops, applied over the server's data until it catches up. */
  const [pending, setPending] = useState<Map<number, PipelineColumnId>>(new Map());
  const [logging, setLogging] = useState<{ c: Company; move: Extract<BoardMove, { kind: "event" }> } | null>(
    null,
  );
  /** Screen-reader narration for a move that has no visual focus to follow. */
  const [announcement, setAnnouncement] = useState("");

  const projectOf = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) m.set(r.c.id, r.projectName);
    return m;
  }, [rows]);

  const board = useMemo(() => {
    let b = buildBoard(rows.map((r) => r.c));
    for (const [id, target] of pending) b = applyStatusMove(b, id, target);
    return b;
  }, [rows, pending]);

  const dragging = useMemo(
    () => (dragId == null ? null : rows.find((r) => r.c.id === dragId)?.c ?? null),
    [dragId, rows],
  );
  const allowed = useMemo(() => (dragging ? legalTargets(dragging) : null), [dragging]);

  // ── Edge auto-scroll: six columns don't fit, so holding a card near either side
  //    of the board scrolls it (same behaviour as the sourcing funnel). ──────────
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollDir = useRef(0);
  const scrollTimer = useRef<number | null>(null);

  const stopAutoScroll = () => {
    scrollDir.current = 0;
    if (scrollTimer.current != null) {
      window.clearInterval(scrollTimer.current);
      scrollTimer.current = null;
    }
  };
  useEffect(() => stopAutoScroll, []);

  const onBoardDragOver = (e: React.DragEvent) => {
    const el = scrollerRef.current;
    if (!el || dragId == null) return;
    const rect = el.getBoundingClientRect();
    const edge = 96;
    scrollDir.current = e.clientX < rect.left + edge ? -1 : e.clientX > rect.right - edge ? 1 : 0;
    if (scrollDir.current !== 0 && scrollTimer.current == null) {
      scrollTimer.current = window.setInterval(() => {
        if (scrollerRef.current && scrollDir.current !== 0) {
          scrollerRef.current.scrollLeft += scrollDir.current * 16;
        }
      }, 16);
    } else if (scrollDir.current === 0) {
      stopAutoScroll();
    }
  };

  /** Optimistic status write, with the undo the app promises everywhere else. */
  const writeStatus = async (c: Company, target: PipelineColumnId, undoable: boolean) => {
    const from = columnOf(c);
    const label = PIPELINE_COLUMNS.find((col) => col.id === target)?.label ?? target;
    setPending((m) => new Map(m).set(c.id, target));
    try {
      await updateCompany.mutateAsync({ id: c.id, data: { status: target } });
      setAnnouncement(`${c.company_name} moved to ${label}`);
      if (undoable) {
        toastUndo(`${c.company_name} → ${label}`, async () => {
          await updateCompany.mutateAsync({ id: c.id, data: { status: from } });
          setPending((m) => {
            const next = new Map(m);
            next.delete(c.id);
            return next;
          });
        }, { undoneMessage: `${c.company_name} moved back` });
      } else {
        toast.success(`${c.company_name} → ${label}`);
      }
    } catch (e: unknown) {
      // Drop the optimistic override; the server's own answer reasserts itself.
      setPending((m) => {
        const next = new Map(m);
        next.delete(c.id);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Move failed");
    }
  };

  /** Single entry point for drag-drop and the per-card menu. */
  const requestMove = async (c: Company, target: PipelineColumnId) => {
    const move = planMove(c, target);
    switch (move.kind) {
      case "noop":
        return;
      case "refused":
        // Not a failure — the board is explaining the domain. Say why, at length.
        toast.error("That move isn't possible", { description: move.reason, duration: 7000 });
        setAnnouncement(`Move refused. ${move.reason}`);
        return;
      case "event":
        // The drag only *proposes* the touch; the log dialog commits it, with a
        // date, a contact and attribution. Nothing is appended behind your back.
        setLogging({ c, move });
        return;
      case "status": {
        if (move.confirm && !(await confirm(move.confirm))) return;
        await writeStatus(c, move.status, move.undoable);
      }
    }
  };

  const onDrop = (target: PipelineColumnId) => {
    setOverCol(null);
    stopAutoScroll();
    const c = dragging;
    setDragId(null);
    if (c) void requestMove(c, target);
  };

  const total = rows.length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium tabular-nums text-foreground">{total}</span>{" "}
          {total === 1 ? "company" : "companies"} in your book
        </span>
        <span className="hidden sm:inline">
          Drag a card, or use its move menu — a column is never written directly.
        </span>
      </div>

      <div
        ref={scrollerRef}
        onDragOver={onBoardDragOver}
        className="flex gap-3 overflow-x-auto pb-2"
        role="group"
        aria-label="Outreach pipeline board"
      >
        {PIPELINE_COLUMNS.map((col) => {
          const items = board[col.id];
          const isOver = overCol === col.id && dragId != null;
          const blocked = allowed != null && !allowed.has(col.id) && columnOf(dragging!) !== col.id;
          return (
            <section
              key={col.id}
              aria-label={`${col.label} — ${items.length} ${items.length === 1 ? "company" : "companies"}`}
              className={cn(
                "flex w-[250px] shrink-0 flex-col rounded-lg border bg-muted/20 transition-colors",
                isOver && !blocked && "border-border-strong bg-accent ring-1 ring-border-strong",
                // A refusal is visible before the drop, not after it.
                blocked && "opacity-45",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = blocked ? "none" : "move";
                if (overCol !== col.id) setOverCol(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(col.id);
              }}
            >
              <div className="border-b px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", col.dot)} aria-hidden />
                    <span className="truncate text-xs font-semibold">{col.label}</span>
                  </div>
                  <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{col.hint}</p>
              </div>

              <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">
                {items.map((c) => (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      // A drag that starts on the card's own controls (the move menu,
                      // the dossier link) is a mis-grab, not a move.
                      if ((e.target as HTMLElement).closest("button,a")) {
                        e.preventDefault();
                        return;
                      }
                      setDragId(c.id);
                      // Firefox won't start a drag without data on the transfer.
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(c.id));
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                      stopAutoScroll();
                    }}
                    className={cn(
                      "group cursor-grab rounded-lg border bg-card p-2.5 text-xs shadow-sm transition-shadow",
                      "hover:shadow-md active:cursor-grabbing",
                      dragId === c.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <Link
                        href={`/companies/${c.id}`}
                        className="min-w-0 flex-1 rounded font-medium leading-snug break-words outline-none hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {c.company_name}
                      </Link>
                      <div className="flex shrink-0 items-center">
                        <GripVertical
                          className="h-3.5 w-3.5 text-ink-300 group-hover:text-muted-foreground"
                          aria-hidden
                        />
                        <MoveMenu company={c} onMove={requestMove} />
                      </div>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] text-muted-foreground">
                        {projectOf.get(c.id) || "Unassigned"}
                      </span>
                      <CadenceChip c={c} />
                    </div>

                    {c.primary_contact && (
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">
                        {c.primary_contact.contact_person}
                      </p>
                    )}
                  </article>
                ))}

                {items.length === 0 && (
                  <p
                    className={cn(
                      "rounded-lg border border-dashed px-2 py-6 text-center text-[11px] text-muted-foreground",
                      isOver && !blocked && "border-border-strong text-primary-ink",
                    )}
                  >
                    {isOver && blocked
                      ? "Can't move here"
                      : isOver
                        ? "Release to move here"
                        : "Empty"}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Moves are narrated: a card that jumps columns leaves no focus behind. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {logging && (
        <LogOutreachDialog
          key={`${logging.c.id}-${logging.move.eventType}`}
          companyId={logging.c.id}
          companyName={logging.c.company_name}
          defaultEventType={logging.move.eventType}
          note={logging.move.consequence}
          open
          onOpenChange={(o) => !o && setLogging(null)}
          trigger={null}
          onLogged={() => setAnnouncement(`${logging.c.company_name}: touch logged`)}
        />
      )}
    </>
  );
}

/** The keyboard path. Illegal destinations stay visible but disabled, with the reason. */
function MoveMenu({
  company,
  onMove,
}: {
  company: Company;
  onMove: (c: Company, target: PipelineColumnId) => void;
}) {
  const here = columnOf(company);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            /* The card is draggable, so without this a mousedown here starts
               dragging the ancestor and the menu never opens. Note: don't add an
               onPointerDown handler — it replaces Base UI's own trigger handler
               rather than merging with it, which breaks the menu a second way. */
            draggable={false}
            className="-mr-1 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            aria-label={`Move ${company.company_name} to another stage`}
          />
        }
      >
        <MoveRight className="h-3.5 w-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* The label must live in a Group — a bare Base UI GroupLabel throws
            "MenuGroupContext is missing" and the menu then never opens at all. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] text-muted-foreground">Move to</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {PIPELINE_COLUMNS.map((col) => {
          const move = planMove(company, col.id);
          const isHere = col.id === here;
          const refused = move.kind === "refused";
          return (
            <DropdownMenuItem
              key={col.id}
              disabled={isHere || refused}
              onClick={() => !isHere && !refused && onMove(company, col.id)}
              title={refused ? move.reason : undefined}
              className="flex items-start gap-2"
            >
              {refused ? (
                <Ban className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", col.dot)} aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{col.label}</span>
                {isHere ? (
                  <span className="block text-[10px] text-muted-foreground">Currently here</span>
                ) : refused ? (
                  <span className="block text-[10px] leading-tight text-muted-foreground">
                    {move.reason}
                  </span>
                ) : move.kind === "event" ? (
                  <span className="block text-[10px] leading-tight text-muted-foreground">
                    Opens the log — appended, never overwritten
                  </span>
                ) : null}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/companies/${company.id}`} />}>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Open dossier
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
