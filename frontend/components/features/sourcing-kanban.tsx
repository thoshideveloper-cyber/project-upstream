"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, GripVertical, Loader2, MoveRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useBoard, type BoardCandidate, type BoardResponse } from "@/hooks/use-candidates";
import { useChangeCandidateStage } from "@/hooks/use-sourcing-stages";
import { useLogInitialEmail } from "@/hooks/use-push";
import { scoreTone, scoreFill, revLabel } from "@/components/features/candidate-card";
import { cn } from "@/lib/utils";
import type { SourcingStageKind } from "@/types";

/**
 * Move a candidate to another column in a cached board, keeping per-column counts
 * in sync. Pure — used for the optimistic drag so the card advances the instant you
 * drop it, before the server round-trip resolves.
 */
export function applyBoardMove(
  board: BoardResponse,
  candidateId: number,
  targetStageId: number,
): BoardResponse {
  const moving = board.columns.flatMap((c) => c.candidates).find((c) => c.id === candidateId);
  if (!moving || moving.stage_id === targetStageId) return board;
  return {
    ...board,
    columns: board.columns.map((col) => {
      if (col.stage.id === moving.stage_id) {
        const candidates = col.candidates.filter((c) => c.id !== candidateId);
        return { ...col, candidates, count: candidates.length };
      }
      if (col.stage.id === targetStageId) {
        const candidates = [{ ...moving, stage_id: targetStageId }, ...col.candidates];
        return { ...col, candidates, count: candidates.length };
      }
      return col;
    }),
  };
}

/**
 * Dragging into ACTIVE for a not-yet-placed candidate is a heavy, hard-to-undo
 * side-effect (materialises a placement + starts cadence), so it must be confirmed
 * rather than committed silently. Research↔Shortlist drags are cheap. Pure — tested.
 */
export function requiresPushConfirm(
  targetKind: SourcingStageKind,
  hasCompany: boolean,
): boolean {
  return targetKind === "ACTIVE" && !hasCompany;
}

/** Per-stage glyph so the board reads as a pipeline, not a list of boxes: each column
 *  is headed by its stage's Harvey ball, which fills as the stage advances. */
const KIND_ACCENT: Record<SourcingStageKind, { dot: string }> = {
  RESEARCH: { dot: "hb hb-0" },
  SHORTLIST: { dot: "hb hb-25" },
  ACTIVE: { dot: "hb hb-50" },
  ENGAGED: { dot: "hb hb-100" },
  PASSED: { dot: "hb hb-mute" },
  CUSTOM: { dot: "hb hb-75" },
};

export function SourcingKanban({
  mandateId,
  focusStageId,
  focusNonce,
}: {
  mandateId: number;
  /** Arriving from the pipeline tape: scroll this stage's column into view and flash it. */
  focusStageId?: number | null;
  /** Bumped on every tape click so re-clicking the same stage re-scrolls. */
  focusNonce?: number;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useBoard(mandateId, mandateId > 0);
  const changeStage = useChangeCandidateStage();
  const logInitial = useLogInitialEmail();

  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const [flashCol, setFlashCol] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{
    candidate: BoardCandidate;
    stageId: number;
  } | null>(null);

  const columns = data?.columns ?? [];
  const colRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Tape → board hand-off: centre the chosen column and flash its ring once.
  useEffect(() => {
    if (!focusStageId || columns.length === 0) return;
    const el = colRefs.current.get(focusStageId);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: reduced ? "auto" : "smooth" });
    setFlashCol(focusStageId);
    const t = window.setTimeout(() => setFlashCol(null), 1200);
    return () => window.clearTimeout(t);
  }, [focusStageId, focusNonce, columns.length]);
  const totalInFunnel = columns.reduce((n, c) => n + c.count, 0);
  const boardKey = ["sourcing-board", mandateId] as const;

  // ── Edge auto-scroll: while dragging, holding a card near either side of the
  //    board scrolls it, so far-off columns (e.g. Passed) are reachable by drag. ──
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

  const move = async (candidateId: number, stageId: number) => {
    // Optimistically advance the card so the move lands instantly; roll back the
    // cached board if the server rejects it.
    const prev = qc.getQueryData<BoardResponse>(boardKey);
    if (prev) qc.setQueryData<BoardResponse>(boardKey, applyBoardMove(prev, candidateId, stageId));
    try {
      await changeStage.mutateAsync({ id: candidateId, stageId });
    } catch (e: unknown) {
      if (prev) qc.setQueryData(boardKey, prev);
      toast.error(e instanceof Error ? e.message : "Move failed");
    }
  };

  /** Single entry point for both drag-drop and the per-card menu. */
  const requestMove = (candidate: BoardCandidate, stageId: number, kind: SourcingStageKind) => {
    if (candidate.stage_id === stageId) return;
    if (requiresPushConfirm(kind, !!candidate.company_id)) {
      setConfirm({ candidate, stageId });
    } else {
      move(candidate.id, stageId);
    }
  };

  const onDrop = (stageId: number, kind: SourcingStageKind) => {
    setOverCol(null);
    stopAutoScroll();
    if (dragId == null) return;
    const candidate = columns.flatMap((c) => c.candidates).find((c) => c.id === dragId);
    setDragId(null);
    if (!candidate) return;
    requestMove(candidate, stageId, kind);
  };

  const confirmActivate = async (alsoLogEmail: boolean) => {
    if (!confirm) return;
    try {
      const res = await changeStage.mutateAsync({
        id: confirm.candidate.id,
        stageId: confirm.stageId,
      });
      const companyId = (res as { company_id?: number })?.company_id;
      if (alsoLogEmail && companyId) {
        await logInitial.mutateAsync({
          companyId,
          date: new Date().toISOString().slice(0, 10),
        });
        toast.success("Activated — initial email logged, cadence started");
      } else {
        toast.success("Activated — placement created");
      }
      setConfirm(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Activate failed");
    }
  };

  if (mandateId <= 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
        Pick an engagement above to see its funnel.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading funnel…
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-medium tabular-nums text-foreground">{totalInFunnel}</span>{" "}
          {totalInFunnel === 1 ? "company" : "companies"} in this funnel
        </span>
        <span className="hidden sm:inline">Drag a card, or use its ⋮ menu, to move it to any stage.</span>
      </div>

      <div ref={scrollerRef} onDragOver={onBoardDragOver} className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col, ci) => {
          const accent = KIND_ACCENT[col.stage.kind] ?? KIND_ACCENT.CUSTOM;
          const isOver = overCol === col.stage.id && dragId != null;
          // Pin the source column (first stage) so it stays put while the rest of
          // the pipeline scrolls under it — you can always drag out of it.
          const pinned = ci === 0;
          return (
            <div
              key={col.stage.id}
              ref={(el) => {
                if (el) colRefs.current.set(col.stage.id, el);
                else colRefs.current.delete(col.stage.id);
              }}
              className={cn(
                "flex w-[248px] shrink-0 flex-col rounded-lg border transition-colors",
                pinned
                  ? "sticky left-0 z-20 bg-background shadow-[10px_0_20px_-12px_rgba(0,0,0,0.45)]"
                  : "bg-muted/20",
                isOver && "border-border-strong bg-accent ring-1 ring-border-strong",
                flashCol === col.stage.id && "col-flash",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overCol !== col.stage.id) setOverCol(col.stage.id);
              }}
              onDragLeave={(e) => {
                // Only clear when the pointer actually leaves the column box.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(col.stage.id, col.stage.kind);
              }}
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", accent.dot)} />
                  <span className="text-xs font-semibold">{col.stage.name}</span>
                </div>
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {col.count}
                </span>
              </div>

              <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">
                {col.candidates.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(c.id);
                      // Firefox refuses to start a drag unless data is set; the
                      // effectAllowed keeps the cursor a "move" throughout.
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(c.id));
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      "group cursor-grab rounded-lg border bg-card p-3 text-xs shadow-sm transition-shadow",
                      "hover:shadow-md active:cursor-grabbing",
                      dragId === c.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="min-w-0 flex-1 break-words font-medium leading-normal">{c.company_name}</span>
                      <div className="flex shrink-0 items-center">
                        <GripVertical
                          className="h-3.5 w-3.5 text-ink-300 group-hover:text-muted-foreground"
                          aria-hidden
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Move ${c.company_name} to another stage`}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="-mr-1 rounded p-0.5 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            <MoveRight className="h-3.5 w-3.5" aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {/* Wrapped: a bare Base UI GroupLabel throws
                                "MenuGroupContext is missing", which stopped this
                                menu — the funnel's only keyboard path for moving a
                                card — from opening at all. */}
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                                Move to stage
                              </DropdownMenuLabel>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            {columns.map((s) => {
                              const sAccent = KIND_ACCENT[s.stage.kind] ?? KIND_ACCENT.CUSTOM;
                              const isCurrent = s.stage.id === c.stage_id;
                              return (
                                <DropdownMenuItem
                                  key={s.stage.id}
                                  disabled={isCurrent}
                                  onClick={() => requestMove(c, s.stage.id, s.stage.kind)}
                                  className="flex items-center gap-2"
                                >
                                  <span className={cn("h-2 w-2 shrink-0 rounded-full", sAccent.dot)} aria-hidden />
                                  <span className="flex-1 truncate">{s.stage.name}</span>
                                  {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-primary-ink" aria-hidden />}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1.5">
                      <span className="truncate text-[11px] text-muted-foreground">
                        {[c.hq, revLabel(c.revenue_inr_cr)].filter((v) => v && v !== "—").join(" · ") || "—"}
                      </span>
                      {c.insufficient_data ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">n/a</span>
                      ) : c.fit_score != null ? (
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                            scoreTone(c.fit_score),
                          )}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {c.fit_score}
                        </span>
                      ) : null}
                    </div>
                    {!c.insufficient_data && c.fit_score != null && (
                      <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full", scoreFill(c.fit_score))}
                          style={{ width: `${Math.max(4, Math.min(100, c.fit_score))}%` }}
                        />
                      </span>
                    )}
                  </div>
                ))}
                {col.candidates.length === 0 && (
                  <p
                    className={cn(
                      "rounded-lg border border-dashed px-2 py-6 text-center text-[11px] text-muted-foreground",
                      isOver && "border-border-strong text-primary-ink",
                    )}
                  >
                    {isOver ? "Release to move here" : "Empty"}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {columns.length === 0 && (
          <div className="w-full rounded-lg border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
            No funnel stages yet. Shortlist a company from the pool to start the funnel.
          </div>
        )}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Active outreach?</DialogTitle>
            <DialogDescription>
              This creates a placement for {confirm?.candidate.company_name} and readies the
              cadence. The clock starts only when you log the initial email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => confirmActivate(false)}
              disabled={changeStage.isPending}
            >
              Activate
            </Button>
            <Button
              size="sm"
              onClick={() => confirmActivate(true)}
              disabled={changeStage.isPending || logInitial.isPending}
            >
              Activate &amp; log initial email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
