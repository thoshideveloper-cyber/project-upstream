"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, FileUp, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useApplyImport,
  usePreviewImport,
  useValidateImport,
  type ImportFieldMeta,
  type ImportPreviewResponse,
  type ImportValidateResponse,
  type ImportApplyResponse,
} from "@/hooks/use-imports";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Step = "upload" | "map" | "validate" | "done";

/** Every REQUIRED field must be mapped to a header before validate/apply. */
export function isMappingComplete(
  fields: ImportFieldMeta[],
  mapping: Record<string, string | null>,
): boolean {
  return fields.filter((f) => f.required).every((f) => !!mapping[f.field]);
}

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [validation, setValidation] = useState<ImportValidateResponse | null>(null);
  const [result, setResult] = useState<ImportApplyResponse | null>(null);

  const previewMut = usePreviewImport();
  const validateMut = useValidateImport();
  const applyMut = useApplyImport();

  const onFile = async (file: File) => {
    try {
      const data = await previewMut.mutateAsync(file);
      setPreview(data);
      setMapping(data.suggested_mapping);
      setStep("map");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const runValidate = async () => {
    if (!preview) return;
    try {
      const v = await validateMut.mutateAsync({ batchId: preview.batch_id, mapping });
      setValidation(v);
      setStep("validate");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Validation failed");
    }
  };

  const runApply = async () => {
    if (!preview) return;
    try {
      const r = await applyMut.mutateAsync({ batchId: preview.batch_id, mapping });
      setResult(r);
      setStep("done");
      toast.success(`Imported — ${r.created} new, ${r.updated} updated`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    }
  };

  const restart = () => {
    setPreview(null);
    setMapping({});
    setValidation(null);
    setResult(null);
    setStep("upload");
  };

  const mappingComplete = preview ? isMappingComplete(preview.fields, mapping) : false;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/sourcing"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sourcing
      </Link>

      <PageHeader
        title="Import companies"
        description="Bring companies into the firm pool — upload, map columns, review duplicates, apply."
        actions={
          <a href={`${API_URL}/imports/template.csv`} className="inline-flex">
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Template
            </Button>
          </a>
        }
      />

      <Stepper step={step} />

      {step === "upload" && (
        <UploadStep onFile={onFile} pending={previewMut.isPending} onCancel={() => router.push("/sourcing")} />
      )}

      {step === "map" && preview && (
        <MapStep
          preview={preview}
          mapping={mapping}
          setMapping={setMapping}
          complete={mappingComplete}
          onBack={restart}
          onNext={runValidate}
          pending={validateMut.isPending}
        />
      )}

      {step === "validate" && validation && (
        <ValidateStep
          validation={validation}
          batchId={preview!.batch_id}
          onBack={() => setStep("map")}
          onApply={runApply}
          pending={applyMut.isPending}
        />
      )}

      {step === "done" && result && <DoneStep result={result} onAnother={restart} />}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "map", label: "Map" },
    { key: "validate", label: "Validate & dedup" },
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
              i < order && "bg-primary text-primary-foreground",
              i === order && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
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
  onFile,
  pending,
  onCancel,
}: {
  onFile: (f: File) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const takeFile = (f: File | undefined) => {
    if (!f) return;
    const looksCsv = f.type === "text/csv" || f.name.toLowerCase().endsWith(".csv");
    if (!looksCsv) {
      toast.error("That doesn't look like a CSV. Export your list as .csv and try again.");
      return;
    }
    onFile(f);
  };

  return (
    <Card>
      <CardContent className="py-8">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!pending) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!pending) takeFile(e.dataTransfer.files?.[0]);
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
              <FileUp className="h-6 w-6 text-primary-ink" />
            </div>
          )}
          <span className="text-sm font-medium">
            {pending ? "Parsing your file…" : dragOver ? "Drop to upload" : "Drop a CSV here, or click to browse"}
          </span>
          <span className="text-xs text-muted-foreground">Delimiter and encoding are auto-detected. Nothing is saved until you apply.</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={pending}
            onChange={(e) => takeFile(e.target.files?.[0])}
          />
        </label>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <p className="text-xs text-muted-foreground">
            No file? Download the template above to see the expected columns.
          </p>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MapStep({
  preview,
  mapping,
  setMapping,
  complete,
  onBack,
  onNext,
  pending,
}: {
  preview: ImportPreviewResponse;
  mapping: Record<string, string | null>;
  setMapping: (m: Record<string, string | null>) => void;
  complete: boolean;
  onBack: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Map columns · {preview.row_count} rows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {preview.fields.map((f) => (
          <div key={f.field} className="flex items-center gap-3">
            <label className="w-40 text-sm">
              {f.label}
              {f.required && <span className="ml-1 text-destructive-ink">*</span>}
            </label>
            <select
              value={mapping[f.field] ?? ""}
              onChange={(e) => setMapping({ ...mapping, [f.field]: e.target.value || null })}
              className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">— not mapped —</option>
              {preview.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
        {!complete && (
          <p className="text-xs text-muted-foreground">Map every field marked * to continue.</p>
        )}
        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Start over
          </Button>
          <Button size="sm" onClick={onNext} disabled={!complete || pending}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Validate & preview dedup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidateStep({
  validation,
  batchId,
  onBack,
  onApply,
  pending,
}: {
  validation: ImportValidateResponse;
  batchId: number;
  onBack: () => void;
  onApply: () => void;
  pending: boolean;
}) {
  const { counts } = validation;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Review before applying</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="New" value={counts.create} tone="text-emerald-600" />
          <Stat label="Update / merge" value={counts.update} tone="text-sky-700 dark:text-sky-400" />
          <Stat label="Errors" value={counts.error} tone="text-destructive-ink" />
        </div>
        {validation.clusters.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {validation.clusters.length} intra-file duplicate cluster(s) will be merged.
          </div>
        )}
        {counts.error > 0 && (
          <a href={`${API_URL}/imports/${batchId}/errors.csv`} className="inline-block text-xs text-primary-ink underline">
            Download {counts.error} error row(s) to fix & re-upload
          </a>
        )}
        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to mapping
          </Button>
          <Button size="sm" onClick={onApply} disabled={pending || counts.create + counts.update === 0}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Apply import
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoneStep({ result, onAnother }: { result: ImportApplyResponse; onAnother: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-sm font-medium">Import complete</p>
        <p className="text-sm text-muted-foreground">
          {result.created} new · {result.updated} updated · {result.skipped} skipped
        </p>
        <div className="mt-2 flex items-center gap-2">
          <a href="/sourcing">
            <Button size="sm">Go to sourcing</Button>
          </a>
          <Button variant="outline" size="sm" onClick={onAnother}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Import another
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
