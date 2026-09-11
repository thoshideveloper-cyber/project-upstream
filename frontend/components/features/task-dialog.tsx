"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { TASK_STATUS_META } from "@/lib/design";
import { TASK_PRIORITY_ORDER, TASK_STATUS_ORDER } from "@/lib/tasks";
import type { Task, TaskCreateInput } from "@/types";

const schema = z.object({
  title: z.string().min(1, "A task needs a title"),
  notes: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["BACKLOG", "IN_PROGRESS", "BLOCKED", "DONE"]),
  due_date: z.string().optional(),
  assignee_id: z.string().optional(),
  project_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * The full task form — everything the inline add row deliberately leaves out.
 *
 * The attachment picker offers projects only. Deeper attachments (a company, a contact)
 * are created *from* that record's own screen, where the thing being attached to is
 * already unambiguous; a flat picker listing every company in the firm would be a worse
 * way to say "on Acme" than the "Add task" item in Acme's own row menu.
 */
export function TaskDialog({
  task,
  open,
  onOpenChange,
  defaults,
  fanOut,
  onDone,
}: {
  /** Present = edit mode. */
  task?: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Attachment for a new task. Its `*_id` fields are passed straight through. */
  defaults?: TaskCreateInput;
  /**
   * Create the same task once per company id, instead of once.
   *
   * For the workspace's bulk "Add task": filing "chase on the phone" across twelve
   * selected companies should produce twelve attached tasks, not one task that names
   * twelve records and therefore belongs to none of them. Each write is independent, so
   * a partial failure is reported as a partial failure.
   */
  fanOut?: number[];
  /** Called after a successful create — lets a caller clear its selection. */
  onDone?: () => void;
}) {
  const isEdit = !!task;
  const create = useCreateTask();
  const update = useUpdateTask();
  const { data: users } = useUsers();
  const { data: projects } = useProjects(false);

  // A task attached to a company or contact keeps that attachment on edit — the dialog
  // shows what it is hanging off, and does not offer to move it. Re-parenting a task
  // between records is a different, rarer action than editing one.
  const fixedAttachment =
    task && task.scope !== "PROJECT" && task.scope !== "PERSONAL"
      ? task.attached_to
      : defaults?.company_id || defaults?.contact_id || defaults?.mandate_id
        ? null
        : undefined;

  const defaultValues = (): FormValues => ({
    title: task?.title ?? "",
    notes: task?.notes ?? "",
    priority: task?.priority ?? defaults?.priority ?? "MEDIUM",
    status: task?.status ?? "BACKLOG",
    due_date: task?.due_date ?? defaults?.due_date ?? "",
    assignee_id: task?.assignee_id ? String(task.assignee_id) : "",
    project_id: task?.project_id
      ? String(task.project_id)
      : defaults?.project_id
        ? String(defaults.project_id)
        : "",
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  });

  useEffect(() => {
    if (open) reset(defaultValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const onSubmit = async (data: FormValues) => {
    try {
      if (isEdit && task) {
        await update.mutateAsync({
          id: task.id,
          data: {
            title: data.title,
            notes: data.notes || null,
            priority: data.priority,
            status: data.status,
            due_date: data.due_date || null,
            assignee_id: data.assignee_id ? Number(data.assignee_id) : null,
          },
        });
        toast.success("Task updated");
      } else {
        // Exactly one attachment reaches the server — it 422s on two, and derives the
        // rest of the chain from whichever one it gets.
        const attachment: Partial<TaskCreateInput> = defaults?.contact_id
          ? { contact_id: defaults.contact_id }
          : defaults?.company_id
            ? { company_id: defaults.company_id }
            : defaults?.mandate_id
              ? { mandate_id: defaults.mandate_id }
              : data.project_id
                ? { project_id: Number(data.project_id) }
                : {};

        const body = {
          title: data.title,
          notes: data.notes || null,
          priority: data.priority,
          status: data.status,
          due_date: data.due_date || null,
          assignee_id: data.assignee_id ? Number(data.assignee_id) : null,
        };

        if (fanOut && fanOut.length > 1) {
          const results = await Promise.allSettled(
            fanOut.map((companyId) =>
              create.mutateAsync({ ...body, company_id: companyId }),
            ),
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed === 0) toast.success(`Task added to ${results.length} companies`);
          else if (failed === results.length) toast.error("Could not add the task");
          else toast.warning(`Added to ${results.length - failed} of ${results.length}`);
        } else {
          await create.mutateAsync({ ...attachment, ...body });
          toast.success("Task added");
        }
      }
      reset();
      onOpenChange(false);
      onDone?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save the task");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="task-title">Title *</Label>
            <Input id="task-title" {...register("title")} className="mt-1" autoFocus />
            {errors.title && (
              <p className="mt-1 text-xs text-destructive-ink">{errors.title.message}</p>
            )}
          </div>

          {fixedAttachment ? (
            <div>
              <Label>On</Label>
              <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                {fixedAttachment.label ?? fixedAttachment.type}
              </div>
            </div>
          ) : fixedAttachment === undefined ? (
            <div>
              <Label htmlFor="task-project">Project</Label>
              <select
                id="task-project"
                {...register("project_id")}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isEdit}
              >
                {/* An unattached task is a personal one — private to its owner, and
                    absent from a partner's firm-wide list. Say so, rather than leaving
                    a blank option that looks like a mistake. */}
                <option value="">No project — a private task</option>
                {projects?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                {...register("status")}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TASK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <select
                id="task-priority"
                {...register("priority")}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TASK_PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-due">Due</Label>
              <Input id="task-due" type="date" {...register("due_date")} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
              <select
                id="task-assignee"
                {...register("assignee_id")}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {users?.items.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="task-notes">Notes</Label>
            <textarea
              id="task-notes"
              {...register("notes")}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Add task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
