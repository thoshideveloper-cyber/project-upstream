"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  useApplyWorkbook,
  useImportTargets,
  useInspectWorkbook,
  usePreviewWorkbook,
  type ApplySummary,
  type InspectResponse,
  type PreviewResponse,
  type SheetKind,
  type SheetPlan,
  type WorkbookPlan,
} from "@/hooks/use-workbook-import";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "review" | "done";

const MANDATE_TYPES = [
  { value: "SELL_SIDE", label: "Sell-side" },
  { value: "BUY_SIDE", label: "Buy-side" },
  { value: "CAPITAL_RAISE", label: "Capital raise" },
];

/** A sheet only needs an engagement decision when it is being imported as a master sheet. */
export function needsMandate(plan: SheetPlan): boolean {
  return plan.kind === "MASTER" || plan.kind === "LONGLIST";
}

/**
 * The plan is complete when the project is decided and every master sheet has an
 * engagement. Both are deliberate partner decisions — a workbook's tab names do not
 * reliably say which client or which deal they belong to, so nothing is inferred.
 */
export function isPlanComplete(plan: WorkbookPlan): boolean {
  const hasProject = !!plan.project_id || !!plan.new_project?.name?.trim();
  if (!hasProject) return false;
  const active = plan.sheets.filter((s) => s.kind !== "IGNORE");
  if (active.length === 0) return false;
  return active.every(
    (s) => !needsMandate(s) || !!s.mandate_id || !!s.new_mandate?.name?.trim(),
  );
}

export default function WorkbookImportPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>("upload");
  const [inspected, setInspected] = useState<InspectResponse | null>(null);
  const [plan, setPlan] = useState<WorkbookPlan>({ sheets: [] });
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  /**
   * A client's book is not one file. It arrives as several workbooks — the master
   * sheets, a second deal's book, the firm-wide contact list — that all belong to
   * ONE project, and the contact list only works once the engagements the other
   * files create already exist. So files are taken together and walked in order,
   * with the project decided once and then locked for the rest of the run.
   *
   * They are walked one at a time rather than merged into a single giant form
   * because each workbook has different tabs, a different scheduler and its own
   * flagged rows — the decisions are per file even though the project is not.
   */
  const [queue, setQueue] = useState<File[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [lockedProject, setLockedProject] = useState<{ id: number; name: string } | null>(null);
  const [applied, setApplied] = useState<ApplySummary[]>([]);

  const inspectMut = useInspectWorkbook();
  const previewMut = usePreviewWorkbook();
  const applyMut = useApplyWorkbook();
  // Scoped server-side: a partner is offered the firm's book, an analyst their own.
  const { data: targets } = useImportTargets(true);

  /** Inspect one file and open the mapping step for it. */
  const startFile = async (file: File, locked: { id: number; name: string } | null) => {
    const data = await inspectMut.mutateAsync(file);
    setInspected(data);
    setPlan({
      // Once the first file has landed, every later file joins the same project —
      // it is no longer a question the wizard should re-ask.
      project_id: locked ? locked.id : null,
      new_project: locked
        ? undefined
        : data.suggested_plan.project.name
          ? {
              name: data.suggested_plan.project.name,
              client_name:
                data.suggested_plan.project.client_name ?? data.suggested_plan.project.name,
            }
          : { name: "", client_name: "" },
      sheets: data.suggested_plan.sheets,
      reason_mandates: Object.fromEntries(
        data.suggested_plan.reasons.map((r) => [r, null]),
      ),
      create_missing_companies: true,
    });
    setPreview(null);
    setStep("map");
  };

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    setTotalFiles(files.length);
    setApplied([]);
    setLockedProject(null);
    const [first, ...rest] = files;
    setQueue(rest);
    try {
      await startFile(first, null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not read that workbook");
    }
  };

  const runPreview = async () => {
    if (!inspected) return;
    try {
      const data = await previewMut.mutateAsync({ batchId: inspected.batch_id, plan });
      setPreview(data);
      setStep("review");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const runApply = async () => {
    if (!inspected) return;
    try {
      const data = await applyMut.mutateAsync({ batchId: inspected.batch_id, plan });
      const done = data.summary;
      setApplied((prev) => [...prev, done]);
      toast.success(`${inspected.filename}: ${done.companies_created} companies imported`);

      // The project the first file resolved to is what the rest of the run joins —
      // read from the server's own answer, not from what the form guessed.
      const locked = lockedProject ?? { id: done.project_id, name: done.project_name };
      setLockedProject(locked);

      if (queue.length > 0) {
        const [next, ...rest] = queue;
        setQueue(rest);
        await startFile(next, locked);
      } else {
        setStep("done");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  const restart = () => {
    setInspected(null);
    setPlan({ sheets: [] });
    setPreview(null);
    setApplied([]);
    setQueue([]);
    setTotalFiles(0);
    setLockedProject(null);
    setStep("upload");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <PageHeader
        title="Import from Excel"
        description="Bring a client workbook in whole — master sheets, the email scheduler and the contact list — as one project with its outreach history intact."
      />

      <Stepper step={step} />

      {totalFiles > 1 && step !== "done" && (
        <FileProgress
          total={totalFiles}
          doneCount={applied.length}
          current={inspected?.filename ?? null}
          remaining={queue.length}
        />
      )}

      {step === "upload" && (
        <UploadStep
          onFiles={onFiles}
          pending={inspectMut.isPending}
          onCancel={() => router.push("/projects")}
        />
      )}

      {step === "map" && inspected && (
        <MapStep
          inspected={inspected}
          plan={plan}
          setPlan={setPlan}
          targets={targets}
          lockedProject={lockedProject}
          onBack={restart}
          onNext={runPreview}
          pending={previewMut.isPending}
        />
      )}

      {step === "review" && preview && (
        <ReviewStep
          preview={preview}
          isLastFile={queue.length === 0}
          onBack={() => setStep("map")}
          onApply={runApply}
          pending={applyMut.isPending || inspectMut.isPending}
        />
      )}

      {step === "done" && applied.length > 0 && (
        <DoneStep summaries={applied} onAnother={restart} />
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "map", label: "Project & engagements" },
    { key: "review", label: "Review" },
    { key: "done", label: "Apply" },
  ];
  const order = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors",
              i < order && "bg-primary text-primary-ink",
              i === order &&
                "bg-primary text-primary-ink ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
              i > order && "bg-muted text-muted-foreground",
            )}
          >
            {i < order ? "✓" : i + 1}
          </span>
          <span className={i <= order ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({
  onFiles,
  pending,
  onCancel,
}: {
  onFiles: (f: File[]) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const takeFiles = (list: FileList | null | undefined) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    const workbooks = picked.filter((f) => f.name.toLowerCase().endsWith(".xlsx"));
    const rejected = picked.length - workbooks.length;
    if (rejected > 0) {
      toast.error(
        rejected === picked.length
          ? "Those don't look like .xlsx workbooks."
          : `Skipped ${rejected} file${rejected === 1 ? "" : "s"} that ${rejected === 1 ? "isn't" : "aren't"} .xlsx.`,
      );
    }
    if (!workbooks.length) return;
    // The contact list has to land after the engagements its Reason column maps onto,
    // and a file picker's order is arbitrary — so sort it last rather than let the
    // run fail on ordering the user never chose.
    const isContactList = (f: File) => /contact/i.test(f.name);
    workbooks.sort((a, b) => Number(isContactList(a)) - Number(isContactList(b)));
    onFiles(workbooks);
  };

  return (
    <Card>
      <CardContent className="py-8">
        <label
          data-testid="workbook-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            if (!pending) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!pending) takeFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40",
            pending && "pointer-events-none opacity-70",
          )}
        >
          {pending ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary-ink" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileSpreadsheet className="h-6 w-6 text-primary-ink" />
            </div>
          )}
          <span className="text-sm font-medium">
            {pending
              ? "Reading the workbook…"
              : dragOver
                ? "Drop to upload"
                : "Drop the client's .xlsx workbooks here, or click to browse"}
          </span>
          <span className="max-w-lg text-xs text-muted-foreground">
            Take the whole book at once — every workbook you drop lands under one project,
            and you map each one in turn. Header blocks, the emailing schedule and empty
            spare tabs are all recognised. Nothing is written until you apply.
          </span>
          <input
            type="file"
            accept=".xlsx"
            multiple
            data-testid="workbook-file-input"
            className="hidden"
            disabled={pending}
            onChange={(e) => takeFiles(e.target.files)}
          />
        </label>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Importing a plain company list instead?{" "}
            <Link href="/sourcing/import" className="text-primary-ink underline">
              Use the CSV importer
            </Link>
            .
          </p>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const KIND_LABEL: Record<SheetKind, string> = {
  MASTER: "Master sheet",
  SCHEDULE: "Email scheduler",
  CONTACTS: "Contact list",
  LONGLIST: "Research long-list",
  IGNORE: "Not imported",
};

function MapStep({
  inspected,
  plan,
  setPlan,
  targets,
  lockedProject,
  onBack,
  onNext,
  pending,
}: {
  inspected: InspectResponse;
  plan: WorkbookPlan;
  setPlan: (p: WorkbookPlan) => void;
  targets: ReturnType<typeof useImportTargets>["data"];
  lockedProject: { id: number; name: string } | null;
  onBack: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  const shapes = useMemo(
    () => Object.fromEntries(inspected.sheets.map((s) => [s.title, s])),
    [inspected.sheets],
  );
  const scheduleSheets = inspected.suggested_plan.schedule_sheets;
  const reasons = inspected.suggested_plan.reasons;
  const complete = isPlanComplete(plan);

  const patchSheet = (title: string, patch: Partial<SheetPlan>) =>
    setPlan({
      ...plan,
      sheets: plan.sheets.map((s) => (s.sheet === title ? { ...s, ...patch } : s)),
    });

  const projectMandates = (targets?.mandates ?? []).filter(
    (m) => !plan.project_id || m.project_id === plan.project_id,
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            1 · {lockedProject ? "Client" : "Which client is this workbook?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lockedProject ? (
            // Decided on the first file of the run; every later workbook joins it.
            <p className="text-xs text-muted-foreground" data-testid="locked-project">
              Landing in{" "}
              <span className="font-medium text-foreground">{lockedProject.name}</span> —
              chosen for the first workbook in this batch, so the rest of the book stays
              together.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Everything you dropped lands under one client. Pick the project it belongs
              to, or name a new one.
            </p>
          )}
          <div className={cn("flex flex-wrap items-center gap-3", lockedProject && "hidden")}>
            <select
              data-testid="project-select"
              value={plan.project_id ?? ""}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  project_id: e.target.value ? Number(e.target.value) : null,
                  sheets: plan.sheets.map((s) => ({ ...s, mandate_id: null })),
                })
              }
              className="h-9 min-w-56 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">— create a new project —</option>
              {(targets?.projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {!plan.project_id && (
              <Input
                data-testid="new-project-name"
                placeholder="New project name"
                className="h-9 max-w-64"
                value={plan.new_project?.name ?? ""}
                onChange={(e) =>
                  setPlan({
                    ...plan,
                    new_project: { name: e.target.value, client_name: e.target.value },
                  })
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">2 · Map each tab to an engagement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Sheet names don&rsquo;t say which deal they belong to, so this is your call — not a guess.
          </p>
          {plan.sheets.map((sheetPlan) => {
            const shape = shapes[sheetPlan.sheet];
            const rows = shape?.data_row_count ?? 0;
            return (
              <div
                key={sheetPlan.sheet}
                data-testid={`sheet-row-${sheetPlan.sheet}`}
                className="rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{sheetPlan.sheet}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {KIND_LABEL[shape?.kind ?? "IGNORE"]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {rows} row{rows === 1 ? "" : "s"}
                      {shape?.exchange_rate ? ` · FX ${shape.exchange_rate}` : ""}
                      {shape?.unmapped_headers?.length
                        ? ` · ${shape.unmapped_headers.length} column(s) with no field in the model`
                        : ""}
                    </p>
                  </div>
                  <select
                    data-testid={`sheet-kind-${sheetPlan.sheet}`}
                    value={sheetPlan.kind}
                    onChange={(e) => patchSheet(sheetPlan.sheet, { kind: e.target.value as SheetKind })}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="IGNORE">Don&rsquo;t import</option>
                    <option value="MASTER">Import as master sheet</option>
                    <option value="CONTACTS">Import as contact list</option>
                  </select>
                </div>

                {needsMandate(sheetPlan) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <span className="text-xs text-muted-foreground">Engagement</span>
                    <select
                      data-testid={`sheet-mandate-${sheetPlan.sheet}`}
                      value={sheetPlan.mandate_id ?? ""}
                      onChange={(e) =>
                        patchSheet(sheetPlan.sheet, {
                          mandate_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="h-8 min-w-48 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="">— create a new engagement —</option>
                      {projectMandates.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    {!sheetPlan.mandate_id && (
                      <>
                        <Input
                          data-testid={`sheet-mandate-name-${sheetPlan.sheet}`}
                          placeholder="Engagement name"
                          className="h-8 max-w-52 text-xs"
                          value={sheetPlan.new_mandate?.name ?? ""}
                          onChange={(e) =>
                            patchSheet(sheetPlan.sheet, {
                              new_mandate: {
                                ...(sheetPlan.new_mandate ?? { type: "BUY_SIDE" }),
                                name: e.target.value,
                              },
                            })
                          }
                        />
                        <select
                          value={sheetPlan.new_mandate?.type ?? "BUY_SIDE"}
                          onChange={(e) =>
                            patchSheet(sheetPlan.sheet, {
                              new_mandate: {
                                ...(sheetPlan.new_mandate ?? { name: sheetPlan.sheet }),
                                type: e.target.value,
                              },
                            })
                          }
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          {MANDATE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    {scheduleSheets.length > 0 && (
                      <>
                        <span className="ml-2 text-xs text-muted-foreground">Cadence from</span>
                        <select
                          value={sheetPlan.schedule_sheet ?? ""}
                          onChange={(e) =>
                            patchSheet(sheetPlan.sheet, { schedule_sheet: e.target.value || null })
                          }
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="">— no scheduler —</option>
                          {scheduleSheets.map((s) => (
                            <option key={s} value={s}>
                              {s}
                              {sheetPlan.schedule_regarding ? ` · ${sheetPlan.schedule_regarding}` : ""}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {reasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3 · Which client is each contact-list row about?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              The contact list&rsquo;s <span className="font-medium">Reason</span> column is the
              client. Rows with no engagement mapped are skipped, never guessed at.
            </p>
            {reasons.map((reason) => (
              <div key={reason} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs">{reason}</span>
                <select
                  data-testid={`reason-${reason}`}
                  value={plan.reason_mandates?.[reason] ?? ""}
                  onChange={(e) =>
                    setPlan({
                      ...plan,
                      reason_mandates: {
                        ...(plan.reason_mandates ?? {}),
                        [reason]: e.target.value ? Number(e.target.value) : null,
                      },
                    })
                  }
                  className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">— skip these rows —</option>
                  {projectMandates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Start over
        </Button>
        <Button
          size="sm"
          data-testid="preview-button"
          onClick={onNext}
          disabled={!complete || pending}
        >
          {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Preview import
        </Button>
      </div>
      {!complete && (
        <p className="text-right text-xs text-muted-foreground">
          Name the project and give every imported sheet an engagement to continue.
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  preview,
  isLastFile,
  onBack,
  onApply,
  pending,
}: {
  preview: PreviewResponse;
  isLastFile: boolean;
  onBack: () => void;
  onApply: () => void;
  pending: boolean;
}) {
  const [showFlagged, setShowFlagged] = useState(false);
  const { counts } = preview;
  const flagged = preview.rows.filter((r) => r.flags.length > 0 || r.action === "ERROR");
  const willWrite =
    counts.companies.create + counts.companies.update + counts.contacts.create > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Review before applying · {preview.project.name ?? "new project"}
            {preview.project.is_new && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                new project
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Companies" value={counts.companies.create} sub={`${counts.companies.update} update`} />
            <Stat label="Contacts" value={counts.contacts.create} sub={`${counts.contacts.update} update`} />
            <Stat label="Outreach events" value={counts.events.append} sub={`${counts.events.duplicate} already logged`} />
            <Stat label="Sourcing layers" value={counts.layers.create} sub="new bands" />
            <Stat label="Errors" value={counts.errors} sub="rows skipped" tone={counts.errors > 0 ? "text-destructive-ink" : undefined} />
          </div>

          <div className="rounded-lg border">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Sheet</th>
                  <th className="px-3 py-2 font-medium">Engagement</th>
                  <th className="px-3 py-2 text-right font-medium">Rows</th>
                  <th className="px-3 py-2 text-right font-medium">Cadence matched</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.sheets.map((s) => (
                  <tr key={s.sheet}>
                    <td className="px-3 py-2">{s.sheet}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.mandate_name ?? "—"}
                      {s.mandate_is_new && s.mandate_name ? " (new)" : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.rows}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {s.schedule_matched ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.flags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                <span className="text-xs font-medium">
                  {flagged.length} row{flagged.length === 1 ? "" : "s"} need a second look
                </span>
                <button
                  data-testid="toggle-flagged"
                  onClick={() => setShowFlagged((v) => !v)}
                  className="text-xs text-primary-ink underline"
                >
                  {showFlagged ? "Hide" : "Show"}
                </button>
              </div>
              <ul className="space-y-1">
                {preview.flags.map((f) => (
                  <li key={f.code} className="text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium text-foreground">{f.count}</span>{" "}
                    {f.label}
                  </li>
                ))}
              </ul>
              {showFlagged && (
                <div className="max-h-80 overflow-y-auto rounded-lg border" data-testid="flagged-rows">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 border-b bg-muted/60 text-left text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Company / person</th>
                        <th className="px-3 py-2 font-medium">What the importer decided</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {flagged.slice(0, 200).map((r) => (
                        <tr key={`${r.sheet}-${r.row_index}`}>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {r.sheet} · {r.excel_row ?? r.row_index}
                          </td>
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {r.message ?? r.flags.map((f) => f.label).join("; ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to mapping
            </Button>
            <Button size="sm" data-testid="apply-button" onClick={onApply} disabled={pending || !willWrite}>
              {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {isLastFile ? "Apply import" : "Apply and continue to the next workbook"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Where the run is up to, once more than one workbook is in flight. */
function FileProgress({
  total,
  doneCount,
  current,
  remaining,
}: {
  total: number;
  doneCount: number;
  current: string | null;
  remaining: number;
}) {
  return (
    <div
      data-testid="file-progress"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs"
    >
      <span className="font-medium">
        Workbook {Math.min(doneCount + 1, total)} of {total}
      </span>
      {current && <span className="truncate text-muted-foreground">{current}</span>}
      <span className="text-muted-foreground">
        · {doneCount} applied
        {remaining > 0 ? ` · ${remaining} still queued` : ""}
      </span>
    </div>
  );
}

function DoneStep({
  summaries,
  onAnother,
}: {
  summaries: ApplySummary[];
  onAnother: () => void;
}) {
  const last = summaries[summaries.length - 1];
  const total = summaries.reduce(
    (acc, s) => ({
      companies: acc.companies + s.companies_created,
      contacts: acc.contacts + s.contacts_created,
      events: acc.events + s.events_appended,
      mandates: acc.mandates + s.mandates.length,
    }),
    { companies: 0, contacts: 0, events: 0, mandates: 0 },
  );

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-sm font-medium" data-testid="import-complete">
          {last.project_name} is live
        </p>
        <p className="text-sm text-muted-foreground">
          {total.companies} companies · {total.contacts} contacts · {total.events} outreach
          events · {total.mandates} engagement{total.mandates === 1 ? "" : "s"}
          {summaries.length > 1 ? ` · from ${summaries.length} workbooks` : ""}
        </p>
        {summaries.length > 1 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {summaries.map((s, i) => (
              <li key={i}>
                {s.companies_created} companies · {s.contacts_created} contacts ·{" "}
                {s.events_appended} events
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Link href={`/projects/${last.project_id}`}>
            <Button size="sm" data-testid="open-project">
              Open {last.project_name}
            </Button>
          </Link>
          <Link href="/schedule">
            <Button size="sm" variant="outline">
              Go to the outreach desk
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onAnother}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Import more workbooks
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={cn("text-2xl font-semibold tabular-nums", tone)}>{value}</div>
      <div className="text-xs font-medium">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
