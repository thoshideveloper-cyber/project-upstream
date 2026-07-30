"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useCreateMandate, useUpdateMandate } from "@/hooks/use-mandates";
import { useUsers } from "@/hooks/use-users";
import { useProjects } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MandateDetail } from "@/types";

const TYPE_OPTIONS = [
  { value: "SELL_SIDE", label: "Sell-side" },
  { value: "BUY_SIDE", label: "Buy-side" },
  { value: "CAPITAL_RAISE", label: "Capital raise" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "CLOSED", label: "Closed" },
  { value: "TERMINATED", label: "Terminated" },
];

const schema = z.object({
  client_name: z.string().min(1, "Client name is required"),
  name: z.string().min(1, "Engagement name is required"),
  type: z.string().min(1),
  status: z.string().min(1),
  project_id: z.string().optional(),
  lead_owner_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  mandate?: MandateDetail;
  trigger?: React.ReactNode;
  /** Pre-link the engagement to this project and lock the selector (used from project detail). */
  projectId?: number;
  /** Pre-fill client name (e.g. from the parent project). */
  defaultClientName?: string;
  /** Pre-select the engagement type. */
  defaultType?: string;
  /** Controlled open state (opt-in). Pass with `trigger={null}` to drive from a menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MandateDialog({
  mandate,
  trigger,
  projectId,
  defaultClientName,
  defaultType,
  open: openProp,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const createMandate = useCreateMandate();
  const updateMandate = useUpdateMandate();
  const { data: users } = useUsers();
  const { data: projects } = useProjects(false);
  const isEdit = !!mandate;
  const projectLocked = projectId != null && !isEdit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_name: mandate?.client_name ?? defaultClientName ?? "",
      name: mandate?.name ?? "",
      type: mandate?.type ?? defaultType ?? "SELL_SIDE",
      status: mandate?.status ?? "ACTIVE",
      project_id: mandate?.project_id
        ? String(mandate.project_id)
        : projectId != null
        ? String(projectId)
        : "",
      lead_owner_id: mandate?.lead_owner_id ? String(mandate.lead_owner_id) : "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        client_name: mandate?.client_name ?? defaultClientName ?? "",
        name: mandate?.name ?? "",
        type: mandate?.type ?? defaultType ?? "SELL_SIDE",
        status: mandate?.status ?? "ACTIVE",
        project_id: mandate?.project_id
          ? String(mandate.project_id)
          : projectId != null
          ? String(projectId)
          : "",
        lead_owner_id: mandate?.lead_owner_id ? String(mandate.lead_owner_id) : "",
      });
    }
  }, [open, mandate, reset, projectId, defaultClientName, defaultType]);

  const onSubmit = async (data: FormValues) => {
    const payload: Record<string, unknown> = {
      client_name: data.client_name,
      name: data.name,
      type: data.type,
      status: data.status,
      project_id: data.project_id ? Number(data.project_id) : null,
      lead_owner_id: data.lead_owner_id ? Number(data.lead_owner_id) : null,
    };
    try {
      if (isEdit) {
        await updateMandate.mutateAsync({ id: mandate.id, data: payload });
        toast.success("Mandate updated");
      } else {
        await createMandate.mutateAsync(payload);
        toast.success("Mandate created");
      }
      reset();
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save mandate");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <span className="contents" onClick={() => setOpen(true)}>
          {trigger ?? <Button size="sm">New engagement</Button>}
        </span>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit engagement" : "New engagement"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {!isEdit && (
            <div>
              <Label htmlFor="project_id">Project (client) *</Label>
              {projectLocked ? (
                <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                  {projects?.items.find((p) => p.id === projectId)?.name ??
                    defaultClientName ??
                    "Selected project"}
                </div>
              ) : (
                <select
                  id="project_id"
                  {...register("project_id")}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a project…</option>
                  {projects?.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="client_name">Client *</Label>
            <Input id="client_name" {...register("client_name")} className="mt-1" />
            {errors.client_name && (
              <p className="mt-1 text-xs text-destructive-ink">{errors.client_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="name">Engagement name *</Label>
            <Input id="name" {...register("name")} className="mt-1" />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive-ink">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                {...register("type")}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                {...register("status")}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="lead_owner_id">Lead owner</Label>
            <select
              id="lead_owner_id"
              {...register("lead_owner_id")}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Unassigned</option>
              {users?.items.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role.toLowerCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
