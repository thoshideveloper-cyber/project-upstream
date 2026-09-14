"use client";

/**
 * The project shell's own dialogs.
 *
 * Lifted out of the old 927-line deal-room page so the layout can mount them once for
 * every view. Behaviour is unchanged — `EditProjectDialog` still patches name and
 * client name, and the team dialog is still the project-membership panel — but the team
 * dialog now wraps `ProjectMembers` (project-level access) rather than the old
 * per-engagement assignment list, because the header's Team avatars have always shown
 * the project's union and clicking them should open the thing they show.
 *
 * Per-engagement analyst assignment did not disappear: it lives on the engagement's own
 * row in the workspace, where the engagement you are assigning to is unambiguous.
 */

import { useState } from "react";
import { toast } from "sonner";

import { ProjectMembers } from "@/components/features/project-members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateProject } from "@/hooks/use-projects";

export function EditProjectDialog({
  projectId,
  currentName,
  currentClientName,
  open,
  onOpenChange,
}: {
  projectId: number;
  currentName: string;
  currentClientName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  // Mounted only while open (see the call site), so these initializers are always fresh.
  const [name, setName] = useState(currentName);
  const [clientName, setClientName] = useState(currentClientName);
  const update = useUpdateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: projectId,
        data: { name: name.trim(), client_name: clientName.trim() },
      });
      toast.success("Project updated");
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-proj-name">Project name</Label>
            <Input
              id="edit-proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-proj-client">Client name</Label>
            <Input
              id="edit-proj-client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Project team</DialogTitle>
        </DialogHeader>
        <div className="pt-1">
          <ProjectMembers projectId={projectId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
