"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";

import {
  useArchiveStage,
  useCreateStage,
  useSourcingStages,
  useUpdateStage,
} from "@/hooks/use-sourcing-stages";
import type { SourcingStage, SourcingStageKind } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const STAGE_KIND_LABEL: Record<SourcingStageKind, string> = {
  RESEARCH: "Research",
  SHORTLIST: "Shortlist",
  ACTIVE: "Active outreach",
  ENGAGED: "Engaged",
  PASSED: "Passed",
  CUSTOM: "Custom",
};

/** True for behavioural stages that the funnel logic depends on (not freely removable). */
export function isBehaviouralStage(kind: SourcingStageKind): boolean {
  return kind !== "CUSTOM";
}

/** Partner-only funnel-stage manager (SOURCING_LAYER_PLAN §4.5). */
export function StageManager() {
  const { data } = useSourcingStages();
  const create = useCreateStage();
  const update = useUpdateStage();
  const archive = useArchiveStage();
  const confirm = useConfirm();
  const [name, setName] = useState("");

  const stages = data?.items ?? [];

  const add = async () => {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ name: name.trim(), kind: "CUSTOM" });
      setName("");
      toast.success("Stage added");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add stage");
    }
  };

  const swap = async (a: SourcingStage, b: SourcingStage) => {
    try {
      await update.mutateAsync({ id: a.id, data: { sort_order: b.sort_order } });
      await update.mutateAsync({ id: b.id, data: { sort_order: a.sort_order } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" /> Sourcing funnel stages ({stages.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          The firm-wide funnel every deal shares (Research → Shortlisted → Active outreach →
          Engaged → Passed). Reorder or add your own stages; the behavioural stages drive the
          push + cadence logic and can&apos;t be duplicated.
        </p>
        <ul className="divide-y">
          {stages.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {STAGE_KIND_LABEL[s.kind]}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  onClick={() => i > 0 && swap(s, stages[i - 1])}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Move ${s.name} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => i < stages.length - 1 && swap(s, stages[i + 1])}
                  disabled={i === stages.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Move ${s.name} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                {!isBehaviouralStage(s.kind) && (
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Archive the "${s.name}" stage?`,
                        description:
                          "It leaves the funnel board. Candidates sitting in it stay on the board under their engagement.",
                        confirmLabel: "Archive",
                        tone: "destructive",
                      });
                      if (!ok) return;
                      try {
                        await archive.mutateAsync(s.id);
                        toast.success("Stage archived");
                      } catch {
                        toast.error("Failed to archive");
                      }
                    }}
                    className="ml-1 text-muted-foreground hover:text-destructive-ink"
                    aria-label={`Archive ${s.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="New custom stage…"
            className="h-9 text-sm"
          />
          <Button
            size="sm"
            className="h-9"
            onClick={add}
            disabled={create.isPending || !name.trim()}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
