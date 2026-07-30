"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  ExternalLink,
  MapPin,
  Users,
  AlertTriangle,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";

import { useCompany, useArchiveCompany, useUnarchiveCompany } from "@/hooks/use-companies";
import { useCycles, usePatchSchedule } from "@/hooks/use-schedule";
import { OutreachTimeline } from "@/components/features/outreach-timeline";
import { useConfirm } from "@/components/features/confirm-dialog";
import { useDelayed } from "@/hooks/use-delayed";
import { toastUndo } from "@/lib/undo-toast";
import { useBenchmark } from "@/hooks/use-analytics";
import { StatusBadge } from "@/components/features/status-badge";
import { CadenceBadge, cadenceStateFromSchedule } from "@/components/features/status-badge";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactDialog } from "@/components/features/contact-dialog";
import { DISPLAY, LABEL, RECORD_TITLE, RECORD_TITLE_STYLE } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { CompanyDetail, Contact } from "@/types";


// ── Field display ────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

// ── Benchmark metric tiles ───────────────────────────────────────────────────

function MetricTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-[136px] flex-1 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none tabular-nums" style={DISPLAY}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BenchmarkStrip({ companyId }: { companyId: number }) {
  const { data: bm } = useBenchmark(companyId);
  if (!bm) return null;

  return (
    <div className="flex flex-wrap gap-3">
      <MetricTile
        label="Touches"
        value={bm.this_company_touches}
        sub={bm.mandate_avg_touches_to_response != null ? `mandate avg ${bm.mandate_avg_touches_to_response}` : undefined}
      />
      {bm.this_company_days_to_response != null && (
        <MetricTile
          label="Days to response"
          value={`${bm.this_company_days_to_response}d`}
          sub={bm.mandate_avg_days_to_response != null ? `mandate avg ${bm.mandate_avg_days_to_response}d` : undefined}
        />
      )}
      <MetricTile
        label="Mandate response rate"
        value={`${Math.round(bm.mandate_response_rate * 100)}%`}
        sub="across this engagement"
      />
    </div>
  );
}

// ── Duplicate warning banner ─────────────────────────────────────────────────

const MATCH_TYPE_LABEL: Record<string, string> = {
  exact_name: "exact name",
  exact_domain: "same domain",
  fuzzy_name: "similar name",
};

function ConfidencePill({ confidence, matchType }: { confidence: number; matchType: string }) {
  const pct = Math.round(confidence * 100);
  const isExact = confidence >= 1.0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        isExact
          ? "bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-200"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      }`}
      title={`Match type: ${MATCH_TYPE_LABEL[matchType] ?? matchType}`}
    >
      {isExact ? MATCH_TYPE_LABEL[matchType] ?? matchType : `${MATCH_TYPE_LABEL[matchType] ?? matchType} · ${pct}%`}
    </span>
  );
}

function DuplicateBanner({ warnings }: { warnings: CompanyDetail["duplicate_warnings"] }) {
  if (!warnings.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Possible duplicate{warnings.length > 1 ? "s" : ""} across mandates
          </p>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((w) => (
              <li key={w.company_id} className="flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <span className="font-medium">{w.company_name}</span>
                <span className="text-amber-500/70">mandate {w.mandate_id}</span>
                <StatusBadge status={w.status} />
                {w.confidence !== undefined && (
                  <ConfidencePill confidence={w.confidence} matchType={w.match_type} />
                )}
                {w.initial_date && (
                  <span className="text-amber-500/70">first contact {w.initial_date}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-amber-600/70 dark:text-amber-400/60">
            Advisory only — these matches may or may not be the same entity.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Contacts tab ─────────────────────────────────────────────────────────────

function ContactsTab({ contacts, companyId }: { contacts: Contact[]; companyId: number }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ContactDialog companyId={companyId} />
      </div>
      {contacts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No contacts yet.</p>
      ) : (
        <div className="divide-y">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-start justify-between py-4 gap-4">
              <div>
                <p className="font-medium text-sm">
                  {c.contact_person}
                  {c.is_primary && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">Primary</Badge>
                  )}
                </p>
                {c.designation && (
                  <p className="text-xs text-muted-foreground">{c.designation}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-right text-xs text-muted-foreground shrink-0">
                <div>
                  {c.email && <p>{c.email}</p>}
                  {c.phone && <p>{c.phone}</p>}
                </div>
                <ContactDialog
                  companyId={companyId}
                  contact={c}
                  trigger={
                    <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                      Edit
                    </button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline tab ─────────────────────────────────────────────────────────────

/**
 * The append-only outreach log as a cadence spine: the live next-due head, every
 * logged touch with its offset from the immutable anchor, and the gaps between
 * them. Cadence values come from the server; nothing is recomputed here.
 */
function TimelineTab({ company }: { company: CompanyDetail }) {
  const { data: cyclesData } = useCycles(company.id);
  const cycles = cyclesData?.items ?? [];

  return (
    <OutreachTimeline
      events={company.events}
      contacts={company.contacts}
      cycles={cycles}
      cadence={{
        scheduleStatus: company.schedule_status,
        nextDueDate: company.next_due_date,
        daysRemaining: company.days_remaining,
        isOverdue: company.is_overdue,
        stoppedReason: company.schedule?.stopped_reason ?? null,
      }}
      emptyAction={
        company.archived_at ? undefined : (
          <LogOutreachDialog
            companyId={company.id}
            companyName={company.company_name}
            defaultEventType={
              company.schedule_status === "AWAITING_INITIAL" ? "INITIAL_EMAIL" : "FOLLOW_UP"
            }
          />
        )
      }
    />
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ company }: { company: CompanyDetail }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Company details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Type" value={company.type} />
            <Field label="Status" value={<StatusBadge status={company.status} />} />
            <Field label="Category" value={company.category_name} />
            <Field label="Sourcing layer" value={company.sourcing_layer_name ?? "Unsorted"} />
            <Field label="HQ" value={company.hq} />
            <Field label="Headcount" value={company.headcount?.toLocaleString()} />
            <Field label="Revenue (INR Cr)" value={company.revenue_inr_cr} />
            <Field label="Revenue source" value={company.revenue_source} />
            <Field label="Source" value={company.source} />
            <Field label="Source quality" value={company.source_quality} />
          </dl>
          {company.profile_id && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Static facts are shared firm-wide (profile #{company.profile_id}) — edits here update
              this company across every engagement.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Outreach schedule</CardTitle></CardHeader>
        <CardContent>
          {/* Focal read: what happens next */}
          {company.schedule_status === "AWAITING_INITIAL" ? (
            <div className="mb-4 rounded-lg border border-indigo-500/25 bg-indigo-500/[0.06] px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Awaiting first email
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The cadence clock starts the moment you log the initial email.
              </p>
            </div>
          ) : company.next_due_date ? (
            <div
              className={cn(
                "mb-4 rounded-lg border px-3.5 py-3",
                company.is_overdue
                  ? "border-destructive/25 bg-destructive/[0.06]"
                  : "border-primary/25 bg-primary/[0.06]",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Next follow-up
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-xl font-semibold tabular-nums" style={DISPLAY}>
                  {company.next_due_date}
                </span>
                {company.days_remaining !== null && (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      company.is_overdue ? "text-destructive-ink" : "text-primary-ink",
                    )}
                  >
                    {company.is_overdue
                      ? `${Math.abs(company.days_remaining)}d overdue`
                      : company.days_remaining === 0
                      ? "due today"
                      : `in ${company.days_remaining}d`}
                  </span>
                )}
              </p>
            </div>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Schedule status" value={
              company.schedule_status ? (
                <CadenceBadge
                  state={cadenceStateFromSchedule({
                    scheduleStatus: company.schedule_status,
                    daysRemaining: company.days_remaining,
                  })}
                />
              ) : null
            } />
            <Field label="Initial date" value={company.initial_date} />
            {company.schedule?.regarding && (
              <Field label="Regarding" value={company.schedule.regarding} />
            )}
            {company.schedule?.stopped_reason && (
              <Field label="Stopped reason" value={company.schedule.stopped_reason} />
            )}
          </dl>
        </CardContent>
      </Card>

      {(company.rationale || company.relevant_investments) && (
        <Card className="sm:col-span-2">
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {company.rationale && (
              <Field label="Rationale" value={<p className="text-sm">{company.rationale}</p>} />
            )}
            {company.relevant_investments && (
              <Field label="Relevant investments" value={<p className="text-sm">{company.relevant_investments}</p>} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Cadence tab ──────────────────────────────────────────────────────────────

function CadenceTab({ company }: { company: CompanyDetail }) {
  const patchSchedule = usePatchSchedule(company.id);
  const sched = company.schedule;
  const isStopped = sched?.status === "STOPPED";
  const canResume = isStopped && sched?.stopped_reason === "MANUAL";
  const isActive = sched?.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Schedule configuration</CardTitle>
            <div className="flex gap-2">
              {isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patchSchedule.mutate({ action: "pause" })}
                >
                  Pause
                </Button>
              )}
              {canResume && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patchSchedule.mutate({ action: "resume" })}
                >
                  Resume
                </Button>
              )}
              <LogOutreachDialog
                companyId={company.id}
                companyName={company.company_name}
                defaultEventType={
                  company.schedule_status === "AWAITING_INITIAL"
                    ? "INITIAL_EMAIL"
                    : "FOLLOW_UP"
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field
              label="Status"
              value={
                company.schedule_status ? (
                  <CadenceBadge
                    state={cadenceStateFromSchedule({
                      scheduleStatus: company.schedule_status,
                      daysRemaining: company.days_remaining,
                    })}
                  />
                ) : null
              }
            />
            <Field label="Initial date (read-only)" value={company.initial_date ?? "Not set yet"} />
            <Field label="Interval (days)" value={sched ? String(sched.cadence_interval_days) : "—"} />
            <Field label="Next follow-up due" value={company.next_due_date ?? "—"} />
            <Field
              label="Days remaining"
              value={
                company.days_remaining !== null
                  ? `${company.days_remaining}d`
                  : "—"
              }
            />
            {sched?.regarding && <Field label="Regarding" value={sched.regarding} />}
            {sched?.stopped_reason && (
              <Field label="Stopped reason" value={sched.stopped_reason} />
            )}
            {sched?.stopped_at && (
              <Field label="Stopped at" value={new Date(sched.stopped_at).toLocaleDateString()} />
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: company, isLoading, error } = useCompany(Number(id));
  const archive = useArchiveCompany();
  const unarchive = useUnarchiveCompany();
  const confirm = useConfirm();
  const showSkeleton = useDelayed(isLoading);

  if (isLoading) {
    if (!showSkeleton) return null;
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted mb-4" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Company not found.</p>
      </div>
    );
  }

  const cadenceState = company.schedule_status
    ? cadenceStateFromSchedule({
        scheduleStatus: company.schedule_status,
        daysRemaining: company.days_remaining,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {company.archived_at ? (
            <>
              <Badge variant="secondary">Archived</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await unarchive.mutateAsync(company.id);
                    toast.success("Company restored");
                  } catch {
                    toast.error("Failed to restore company");
                  }
                }}
              >
                <ArchiveRestore className="mr-1 h-4 w-4" />
                Restore
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const ok = await confirm({
                  title: "Archive this company?",
                  description:
                    "It drops out of the Master List and the schedule. Nothing is destroyed — you can restore it from here, or undo straight after.",
                  confirmLabel: "Archive",
                  tone: "destructive",
                });
                if (!ok) return;
                try {
                  await archive.mutateAsync(company.id);
                  toastUndo(`${company.company_name} archived`, () =>
                    unarchive.mutateAsync(company.id),
                  );
                  router.back();
                } catch {
                  toast.error("Failed to archive company");
                }
              }}
            >
              <Archive className="mr-1 h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/[0.06] blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={company.status} />
              {cadenceState && (
                <CadenceBadge
                  state={cadenceState}
                  label={
                    company.is_overdue
                      ? `${Math.abs(company.days_remaining!)}d overdue`
                      : company.days_remaining !== null
                      ? `due in ${company.days_remaining}d`
                      : undefined
                  }
                />
              )}
            </div>
            <h1 className={cn("mt-2.5 truncate", RECORD_TITLE)} style={RECORD_TITLE_STYLE}>
              {company.company_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {company.category_name && <span>{company.category_name}</span>}
              {company.hq && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {company.hq}
                </span>
              )}
              {company.headcount && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {company.headcount.toLocaleString()}
                </span>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
              {company.linkedin && (
                <a
                  href={company.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
                </a>
              )}
            </div>
          </div>
          {!company.archived_at && (
            <div className="shrink-0">
              <LogOutreachDialog
                companyId={company.id}
                companyName={company.company_name}
                defaultEventType={
                  company.schedule_status === "AWAITING_INITIAL" ? "INITIAL_EMAIL" : "FOLLOW_UP"
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Benchmark metric tiles */}
      <BenchmarkStrip companyId={company.id} />

      {/* Duplicate warning */}
      <DuplicateBanner warnings={company.duplicate_warnings} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cadence">Cadence</TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts ({company.contacts.length})
            </TabsTrigger>
            <TabsTrigger value="timeline">
              Timeline ({company.events.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab company={company} />
        </TabsContent>

        <TabsContent value="cadence" className="mt-4">
          <CadenceTab company={company} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsTab contacts={company.contacts} companyId={company.id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineTab company={company} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
