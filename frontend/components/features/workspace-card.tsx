"use client";

import { useState } from "react";
import Link from "next/link";
import { Database, FileSpreadsheet, Loader2, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useResetWorkspace, useWorkspace } from "@/hooks/use-workspace";
import { LABEL, MONO } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * Workspace — what this firm holds, and the one way to start its book over.
 *
 * The card exists because the product's onboarding is "upload your three spreadsheets",
 * and the first attempt is rarely the last: a sheet gets mapped to the wrong engagement, a
 * client sends a corrected file, a partner wants to walk the empty state again. Without
 * this, fixing that means archiving hundreds of rows by hand.
 *
 * It states the three tiers plainly — the book a reset removes, the company database and
 * configuration it keeps — because "reset" is meaningless until you know its blast radius.
 * Type-to-confirm rather than a yes/no modal: the friction should be proportional to the
 * fact that this is the only irreversible action in an otherwise soft-delete-only app.
 */

const BOOK_LABEL: Record<string, string> = {
  projects: "Projects",
  mandates: "Engagements",
  companies: "Companies",
  contacts: "Contacts",
  outreach_schedules: "Schedules",
  outreach_events: "Outreach events",
  sent_emails: "Sent emails",
  sourcing_candidates: "Funnel candidates",
  sourcing_layers: "Buckets",
  import_batches: "Import batches",
  import_rows: "Import rows",
  saved_searches: "Saved searches",
  mandate_assignments: "Assignments",
};

/** The order an analyst thinks in — deal down to evidence — not the delete order. */
const BOOK_ORDER = [
  "projects",
  "mandates",
  "companies",
  "contacts",
  "outreach_schedules",
  "outreach_events",
  "sent_emails",
  "sourcing_candidates",
  "import_batches",
];

function Tier({
  icon,
  title,
  value,
  note,
  tone = "keep",
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
  tone?: "keep" | "clear";
}) {
  return (
    <div className="bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className={LABEL}>{title}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold leading-none tabular-nums",
          "text-foreground",
        )}
        style={MONO}
      >
        {value}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

export function WorkspaceCard() {
  const { user } = useAuth();
  const { data: ws, isLoading } = useWorkspace();
  const reset = useResetWorkspace();
  const [arming, setArming] = useState(false);
  const [typed, setTyped] = useState("");

  const isPartner = user?.role === "PARTNER";
  const firmName = ws?.firm.name ?? user?.firm.name ?? "";
  const matches = typed.trim() === firmName && firmName.length > 0;
  const bookTotal = ws?.book_total ?? 0;

  const run = async () => {
    if (!matches) return;
    try {
      const res = await reset.mutateAsync(typed.trim());
      setArming(false);
      setTyped("");
      toast.success(
        `Workspace reset — ${res.deleted_total.toLocaleString("en-IN")} rows removed`,
        {
          description: `${res.kept.database_companies.toLocaleString("en-IN")} companies kept in the database. Import a workbook to rebuild the book.`,
        },
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" aria-hidden /> Workspace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          Everything below <span className="font-medium text-foreground">{firmName}</span> is
          private to this firm. The company database ships filled with real research; the book
          arrives when someone here{" "}
          <Link href="/import" className="font-medium text-primary-ink hover:underline">
            imports a workbook
          </Link>
          .
        </p>

        {isLoading || !ws ? (
          <div className="grid gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse bg-card" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border sm:grid-cols-3">
              <Tier
                icon={<Database className="h-3.5 w-3.5" aria-hidden />}
                title="Company database"
                value={ws.database.companies.toLocaleString("en-IN")}
                note="Standing research, searchable in Discover. A reset keeps every row."
              />
              <Tier
                icon={<FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />}
                title="Imported book"
                value={bookTotal.toLocaleString("en-IN")}
                note={
                  bookTotal === 0
                    ? "Nothing imported yet — this firm is a clean slate."
                    : "Records created by imports. A reset removes all of them."
                }
                tone={bookTotal > 0 ? "clear" : "keep"}
              />
              <Tier
                icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                title="Configuration"
                value={`${ws.config.users} ${ws.config.users === 1 ? "user" : "users"}`}
                note={`${ws.config.categories} categories · ${ws.config.stages} funnel stages. Kept.`}
              />
            </div>

            {bookTotal > 0 && (
              <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                {BOOK_ORDER.filter((k) => ws.book[k]).map((k) => (
                  <div key={k} className="flex items-baseline gap-1.5">
                    <dt className="text-muted-foreground">{BOOK_LABEL[k] ?? k}</dt>
                    <dd className="font-semibold tabular-nums" style={MONO}>
                      {ws.book[k].toLocaleString("en-IN")}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {/* The reset itself — only a partner can fire it, and only by name. */}
            {isPartner ? (
              bookTotal === 0 ? (
                <p className="text-xs text-muted-foreground">
                  There is no book to reset yet.
                </p>
              ) : !arming ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setArming(true)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Reset workspace
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Clears the imported book so the workbooks can be re-imported clean.
                  </span>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg bg-danger-soft p-3.5 ring-1 ring-inset ring-danger-line">
                  <p className="text-sm font-medium text-danger-ink">
                    Delete {bookTotal.toLocaleString("en-IN")} records from{" "}
                    {firmName}&rsquo;s book?
                  </p>
                  <p className="max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
                    Projects, engagements, companies, contacts, schedules, the outreach event
                    log and every staged import go. This one is not an archive — those rows are
                    gone for good. The {ws.database.companies.toLocaleString("en-IN")}-company
                    database, your team and all firm configuration stay exactly as they are.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="reset-confirm" className="text-xs text-muted-foreground">
                      Type <span className="font-semibold text-foreground">{firmName}</span> to
                      confirm
                    </label>
                    <Input
                      id="reset-confirm"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && matches && run()}
                      placeholder={firmName}
                      autoComplete="off"
                      className="h-8 w-56 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      disabled={!matches || reset.isPending}
                      onClick={run}
                    >
                      {reset.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      )}
                      {reset.isPending ? "Resetting…" : "Reset workspace"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => {
                        setArming(false);
                        setTyped("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                Only a partner can reset the workspace.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
