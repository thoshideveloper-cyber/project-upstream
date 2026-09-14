"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import {
  useCreateEngagement,
  useLogInitialEmail,
  usePush,
  type PushEngagementChoice,
  type PushResponse,
} from "@/hooks/use-push";
import { dealLabel } from "@/lib/labels";
import type { WarmHistory } from "@/types";

const SIDES = [
  { value: "SELL_SIDE", label: "Sell-side (find buyers)" },
  { value: "BUY_SIDE", label: "Buy-side (find targets)" },
  { value: "CAPITAL_RAISE", label: "Capital raise (find investors)" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: number;
  companyName: string;
  /** Preselect the project/side you're already sourcing for. */
  defaultProjectId?: number;
  defaultSide?: string;
}

export function PushToDialog({
  open,
  onOpenChange,
  profileId,
  companyName,
  defaultProjectId,
  defaultSide,
}: Props) {
  const { data: projects } = useProjects();
  const push = usePush();
  const createEngagement = useCreateEngagement();
  const logInitial = useLogInitialEmail();

  const [projectId, setProjectId] = useState<number>(defaultProjectId ?? 0);
  const [side, setSide] = useState<string>(defaultSide ?? "SELL_SIDE");
  const [res, setRes] = useState<PushResponse | null>(null);
  const [pushedCompanyId, setPushedCompanyId] = useState<number | null>(null);
  const [warm, setWarm] = useState<WarmHistory[]>([]);

  const reset = () => {
    setRes(null);
    setPushedCompanyId(null);
    setWarm([]);
  };

  const doPush = async (mandateId?: number) => {
    if (!projectId) {
      toast.error("Pick a project");
      return;
    }
    try {
      const r = await push.mutateAsync({
        profile_id: profileId,
        project_id: projectId,
        side,
        mandate_id: mandateId,
      });
      setRes(r);
      if (r.pushed || r.already_present) {
        setPushedCompanyId(r.company_id ?? null);
        setWarm(r.warm_history ?? []);
        toast.success(
          r.already_present ? `${companyName} is already in this deal` : `${companyName} pushed`,
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Push failed");
    }
  };

  const offerCreate = async () => {
    try {
      const eng = await createEngagement.mutateAsync({ project_id: projectId, side });
      await doPush(eng.mandate_id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create engagement");
    }
  };

  const logInitialEmail = async () => {
    if (!pushedCompanyId) return;
    try {
      await logInitial.mutateAsync({
        companyId: pushedCompanyId,
        date: new Date().toISOString().slice(0, 10),
      });
      toast.success("Initial email logged — cadence started");
      onOpenChange(false);
      reset();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to log email");
    }
  };

  const pending = push.isPending || createEngagement.isPending;
  const success = res?.pushed || res?.already_present;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Push {companyName} to a deal</DialogTitle>
          <DialogDescription>
            Pick a project and side — we&apos;ll create the placement and ready the cadence.
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Project</label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(Number(e.target.value));
                  reset();
                }}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value={0}>Select a project…</option>
                {(projects?.items ?? []).map((p) => {
                  const l = dealLabel(p.client_name, p.name);
                  return (
                    <option key={p.id} value={p.id}>
                      {l.secondary ? `${l.secondary} — ${l.primary}` : l.primary}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Side</label>
              <select
                value={side}
                onChange={(e) => {
                  setSide(e.target.value);
                  reset();
                }}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {SIDES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {res?.needs_choice && (
              <div className="rounded-md border p-2">
                <p className="mb-2 text-xs text-muted-foreground">
                  Several engagements of this side — pick one:
                </p>
                <div className="space-y-1">
                  {res.needs_choice.map((c: PushEngagementChoice) => (
                    <Button
                      key={c.mandate_id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => doPush(c.mandate_id)}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {res && res.can_create === true && (
              <div className="rounded-md border border-foreground bg-card p-2 text-xs">
                No {side.replace("_", " ").toLowerCase()} engagement yet.
                <Button size="sm" className="ml-2 h-7 text-xs" onClick={offerCreate}>
                  Create it & push
                </Button>
              </div>
            )}
            {res && res.can_create === false && (
              <div className="rounded-md border border-foreground bg-card p-2 text-xs">
                No engagement of this side exists. Ask a partner to create one.
                {res.existing_sides && res.existing_sides.length > 0 && (
                  <span> Existing sides: {res.existing_sides.join(", ")}.</span>
                )}
              </div>
            )}

            {!res?.needs_choice && res?.can_create === undefined && (
              <Button onClick={() => doPush()} disabled={pending || !projectId}>
                {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <Send className="mr-1.5 h-3.5 w-3.5" /> Push
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {warm.length > 0 && (
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                {warm
                  .filter((w) => w.visible)
                  .map(
                    (w) =>
                      `Worked by ${w.poc ?? "team"} for ${w.client_name ?? w.mandate_name} — ${
                        w.sentiment ?? "—"
                      }${w.last_touch ? `, ${w.last_touch}` : ""}`,
                  )
                  .join("; ") || "No prior visible touches."}
              </div>
            )}
            <p className="text-sm">
              {res?.already_present
                ? "This company is already in the deal."
                : "Pushed. Log the initial email to start the cadence clock?"}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              {!res?.already_present && (
                <Button size="sm" onClick={logInitialEmail} disabled={logInitial.isPending}>
                  {logInitial.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Log initial email
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
