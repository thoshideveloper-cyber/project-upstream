"use client";

/**
 * Bulk actions over a selection of companies.
 *
 * Every action here maps to an endpoint that already exists, and the list stops exactly
 * where the data model does. In particular there is **no "Assign"**: a company has no
 * owner field. People are attached to *engagements* (mandate assignments) and to *tasks*
 * (assignee), so an assign control on a company row would have to invent a relationship
 * and then fail to save it. Offering an action the model cannot honour is worse than
 * omitting it, because the user believes it worked.
 *
 * Writes fan out client-side with `Promise.allSettled` — the same shape as the existing
 * bulk outreach clear — and report partial failure honestly rather than claiming a whole
 * batch succeeded because the first request did.
 */

import { useMemo, useState } from "react";
import { CheckSquare, Loader2, Send, Tag } from "lucide-react";
import { toast } from "sonner";

import { BulkBar } from "@/components/features/bulk-bar";
import { TaskDialog } from "@/components/features/task-dialog";
import { useConfirm } from "@/components/features/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCategories } from "@/hooks/use-categories";
import { useUpdateCompany } from "@/hooks/use-companies";
import { useBulkLogEvents } from "@/hooks/use-schedule";
import { STATUS_META } from "@/lib/design";
import { todayISO } from "@/lib/tasks";
import type { Company, CompanyStatus } from "@/types";

/** Statuses a person sets by hand. The rest are written by the outreach log. */
const SETTABLE: CompanyStatus[] = ["INTERESTED", "DECLINED", "NOT_CONTACTED"];

export function WorkspaceBulkActions({
  selected,
  companies,
  onClear,
}: {
  selected: Set<number>;
  /** The full loaded book, so a selection can be resolved to records. */
  companies: Company[];
  onClear: () => void;
}) {
  const confirm = useConfirm();
  const bulkLog = useBulkLogEvents();
  const updateCompany = useUpdateCompany();
  const { data: categoriesData } = useCategories();
  const [taskFor, setTaskFor] = useState<Company[] | null>(null);
  const [busy, setBusy] = useState(false);

  const picked = useMemo(
    () => companies.filter((c) => selected.has(c.id)),
    [companies, selected],
  );

  // Only the rows whose cadence is actually running can take a touch. Logging an
  // outreach against a stopped or cold schedule is not a no-op, it is a wrong record.
  const touchable = useMemo(
    () => picked.filter((c) => !c.is_cold && (c.schedule_status === "ACTIVE" || c.schedule_status === "AWAITING_INITIAL")),
    [picked],
  );

  if (picked.length === 0) return null;

  const report = (verb: string, total: number, failed: number) => {
    if (failed === 0) toast.success(`${verb} ${total} ${total === 1 ? "company" : "companies"}`);
    else if (failed === total) toast.error(`Couldn't ${verb.toLowerCase()} any of the ${total}`);
    else toast.warning(`${verb} ${total - failed} of ${total} — ${failed} failed`);
  };

  const logTouches = async () => {
    const ok = await confirm({
      title: `Log a touch on ${touchable.length} ${touchable.length === 1 ? "company" : "companies"}?`,
      description:
        "Each one gets the touch its own schedule is waiting for — a first email where the clock hasn't started, a follow-up where it has. The outreach log is append-only, so this cannot be edited away afterwards.",
      confirmLabel: "Log touches",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await bulkLog.mutateAsync(
        touchable.map((c) => ({
          companyId: c.id,
          payload: {
            event_type:
              c.schedule_status === "AWAITING_INITIAL" ? "INITIAL_EMAIL" : "FOLLOW_UP",
            occurred_on: todayISO(),
          },
        })),
      );
      report("Logged a touch on", res.total, res.failed);
      onClear();
    } finally {
      setBusy(false);
    }
  };

  const patchAll = async (data: Record<string, unknown>, verb: string) => {
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        picked.map((c) => updateCompany.mutateAsync({ id: c.id, data })),
      );
      report(verb, results.length, results.filter((r) => r.status === "rejected").length);
      onClear();
    } finally {
      setBusy(false);
    }
  };

  const categories = categoriesData?.items ?? [];

  return (
    <>
      <BulkBar count={picked.length} noun={picked.length === 1 ? "company" : "companies"} onClear={onClear}>
        {touchable.length > 0 && (
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={logTouches}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="mr-1 h-3.5 w-3.5" aria-hidden />
            )}
            Log touch
            {touchable.length !== picked.length && (
              <span className="ml-1 opacity-70">({touchable.length})</span>
            )}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => setTaskFor(picked)}
          disabled={busy}
        >
          <CheckSquare className="mr-1 h-3.5 w-3.5" aria-hidden />
          Add task
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={busy} />
            }
          >
            <Tag className="mr-1 h-3.5 w-3.5" aria-hidden />
            Classify
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="z-50 max-h-80 w-52 overflow-y-auto">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Set status</p>
            {SETTABLE.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => patchAll({ status: s }, `Set ${STATUS_META[s].label.toLowerCase()} on`)}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} aria-hidden />
                {STATUS_META[s].label}
              </DropdownMenuItem>
            ))}
            {categories.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Set category</p>
                {categories.map((cat) => (
                  <DropdownMenuItem
                    key={cat.id}
                    onClick={() => patchAll({ category_id: cat.id }, `Moved to ${cat.name}:`)}
                  >
                    {cat.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </BulkBar>

      {/* One task per company, each pre-attached, so the server derives the engagement
          and project from the record rather than being told. */}
      {taskFor && (
        <TaskDialog
          open
          onOpenChange={(o) => !o && setTaskFor(null)}
          defaults={{ title: "", company_id: taskFor[0].id }}
          fanOut={taskFor.length > 1 ? taskFor.map((c) => c.id) : undefined}
          onDone={onClear}
        />
      )}
    </>
  );
}
