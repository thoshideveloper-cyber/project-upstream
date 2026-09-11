"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDeleteProject, useDeletionPreview } from "@/hooks/use-projects";
import { LABEL } from "@/lib/design";
import { cn } from "@/lib/utils";

const MONO = { fontVariantNumeric: "tabular-nums" } as const;

/** Order and copy for the count table — the tables an analyst actually recognises. */
const ROWS: { key: string; label: string }[] = [
  { key: "mandates", label: "Engagements" },
  { key: "companies", label: "Companies" },
  { key: "contacts", label: "Contacts" },
  { key: "outreach_events", label: "Outreach events" },
  { key: "outreach_schedules", label: "Cadences" },
  { key: "tasks", label: "Tasks" },
  { key: "activity_events", label: "Activity records" },
  { key: "sent_emails", label: "Sent emails" },
  { key: "import_batches", label: "Import batches" },
];

/**
 * The permanent delete, with the rails in front of it.
 *
 * The counts do more work than the name box. The name box prevents a mis-click; the
 * counts prevent a misunderstanding — "this removes 412 companies and 1,203 outreach
 * events" is the sentence that stops the wrong delete, and it is why the dialog waits
 * for the preview before it will accept a confirmation at all.
 *
 * The dialog is only reachable on a project that is already archived; the server
 * enforces that with a 409 regardless.
 */
export function DeleteProjectDialog({
  open,
  onOpenChange,
  ...props
}: {
  projectId: number;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, so the typed confirmation starts empty every time
          without an effect resetting it — a half-typed name left over from a previous
          project is exactly the state this dialog exists to prevent. */}
      {open && <DeleteBody {...props} onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function DeleteBody({
  projectId,
  projectName,
  onOpenChange,
  onDeleted,
}: {
  projectId: number;
  projectName: string;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [typed, setTyped] = useState("");
  const preview = useDeletionPreview(projectId, true);
  const del = useDeleteProject();

  const matches = typed.trim() === projectName;
  const counts = preview.data?.counts ?? {};
  const shown = ROWS.filter((r) => (counts[r.key] ?? 0) > 0);

  const run = async () => {
    try {
      const result = await del.mutateAsync({ id: projectId, name: projectName });
      toast.success(
        `${projectName} deleted — ${result.total.toLocaleString("en-IN")} records removed`,
      );
      onOpenChange(false);
      onDeleted?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not delete the project");
    }
  };

  return (
    <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive-ink" aria-hidden />
            Delete {projectName} permanently
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm leading-relaxed text-muted-foreground">
            This is not an archive. Everything filed under this project is removed from
            the database and cannot be restored.
          </p>

          {preview.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Counting what would be removed…
            </div>
          ) : preview.isError ? (
            <p className="rounded-lg bg-destructive/[0.06] p-3 text-sm text-destructive-ink ring-1 ring-destructive/25">
              Couldn&rsquo;t work out what this would remove, so the delete is disabled.
              Close this and try again.
            </p>
          ) : (
            <div className="rounded-lg bg-destructive/[0.06] p-3 ring-1 ring-destructive/25">
              <p className={cn(LABEL, "mb-2")}>This removes</p>
              {shown.length === 0 ? (
                <p className="text-sm">
                  Just the project itself — there is nothing filed under it.
                </p>
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {shown.map((r) => (
                    <div key={r.key} className="flex items-baseline justify-between gap-2">
                      <dt className="truncate text-muted-foreground">{r.label}</dt>
                      <dd className="shrink-0 font-medium tabular-nums" style={MONO}>
                        {(counts[r.key] ?? 0).toLocaleString("en-IN")}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-3 border-t border-destructive/20 pt-2 text-xs leading-relaxed text-muted-foreground">
                Your firm&rsquo;s company database, saved searches, funnel stages and
                team are not touched.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="delete-confirm" className="text-xs text-muted-foreground">
              Type <span className="font-semibold text-foreground">{projectName}</span>{" "}
              to confirm
            </label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches && preview.isSuccess) void run();
              }}
              placeholder={projectName}
              autoComplete="off"
              className="h-9"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!matches || !preview.isSuccess || del.isPending}
              onClick={run}
            >
              {del.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="mr-1.5 size-4" aria-hidden />
              )}
              {del.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
      </div>
    </DialogContent>
  );
}
