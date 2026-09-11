"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, X } from "lucide-react";

import { useCompanies, type CompanyFilters } from "@/hooks/use-companies";
import { AddCompanyDialog } from "@/components/features/add-company";
import { DataTable, type Column } from "@/components/features/data-table";
import { StatusBadge } from "@/components/features/status-badge";
import { CadenceBadge, cadenceStateFromSchedule } from "@/components/features/status-badge";
import { EmptyState } from "@/components/features/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DISPLAY, SELECT_CLS } from "@/lib/design";
import { cn } from "@/lib/utils";
import { useCounter } from "@/hooks/use-counter";
import type { Company, CompanyStatus, CompanyType } from "@/types";


// Where a company came from — a small legend keys the shaded dots in the table. Own
// research is solid ink; anything that arrived from outside is lighter, down to an
// empty ring for a bulk import nobody has vouched for yet.
const SOURCE_META: { value: string; label: string; dot: string }[] = [
  { value: "PROPRIETARY", label: "Proprietary", dot: "bg-foreground" },
  { value: "PUBLIC", label: "Public", dot: "bg-ink-500" },
  { value: "REFERRAL", label: "Referral", dot: "bg-ink-300" },
  { value: "IMPORTED", label: "Imported", dot: "bg-card ring-1 ring-inset ring-ink-400" },
];
const SOURCE_DOT: Record<string, string> = Object.fromEntries(
  SOURCE_META.map((s) => [s.value, s.dot]),
);

// Status steps for the composition bar, in the product's state colours: untouched is
// light grey, contacted blue (in flight), a reply green — deeper once they are
// interested — a decline closes to grey, a bounce is red (it never reached anyone).
const SPECTRUM: Record<CompanyStatus, { label: string; color: string }> = {
  NOT_CONTACTED: { label: "Not contacted", color: "var(--ink-200)" },
  CONTACTED: { label: "Contacted", color: "var(--info)" },
  RESPONDED: { label: "Responded", color: "oklch(0.8 0.1 155)" },
  INTERESTED: { label: "Interested", color: "var(--success)" },
  DECLINED: { label: "Declined", color: "var(--ink-400)" },
  BOUNCED: { label: "Bounced", color: "var(--danger)" },
};
const STATUS_ORDER: CompanyStatus[] = [
  "NOT_CONTACTED",
  "CONTACTED",
  "RESPONDED",
  "INTERESTED",
  "DECLINED",
  "BOUNCED",
];

const PAGE_SIZE = 25;

const STATUS_OPTIONS: { label: string; value: CompanyStatus | "" }[] = [
  { label: "All statuses", value: "" },
  { label: "Not contacted", value: "NOT_CONTACTED" },
  { label: "Contacted", value: "CONTACTED" },
  { label: "Responded", value: "RESPONDED" },
  { label: "Interested", value: "INTERESTED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Bounced", value: "BOUNCED" },
];

const TYPE_OPTIONS: { label: string; value: CompanyType | "" }[] = [
  { label: "All types", value: "" },
  { label: "Target", value: "TARGET" },
  { label: "Buyer", value: "BUYER" },
  { label: "Investor", value: "INVESTOR" },
];

/** website → bare domain for the company subline. Tolerant of missing scheme. */
function domainOf(website: string | null): string | null {
  if (!website) return null;
  const raw = website.trim();
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

function cadenceLabel(company: Company): React.ReactNode {
  if (!company.schedule_status) return null;
  const state = cadenceStateFromSchedule({
    scheduleStatus: company.schedule_status,
    daysRemaining: company.days_remaining,
  });
  let label: string | undefined;
  if (state === "overdue") label = `${Math.abs(company.days_remaining!)}d overdue`;
  else if (state === "due_soon") label = `due in ${company.days_remaining}d`;
  return <CadenceBadge state={state} label={label} />;
}

const COLUMNS: Column<Company>[] = [
  {
    key: "company_name",
    header: "Company",
    cell: (row) => {
      const domain = domainOf(row.website);
      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ring-2 ring-inset ring-white/10 ${SOURCE_DOT[row.source] ?? "bg-muted-foreground/50"}`}
            title={row.source}
          />
          <div className="flex min-w-0 flex-col">
            <span className="font-medium truncate max-w-[200px]">{row.company_name}</span>
            {domain && (
              <span className="truncate max-w-[200px] text-xs text-muted-foreground">
                {domain}
              </span>
            )}
          </div>
        </div>
      );
    },
    className: "w-[240px]",
  },
  {
    key: "category",
    header: "Category",
    cell: (row) => (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {row.type}
        </span>
        {row.category_name && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 w-fit">
            {row.category_name}
          </Badge>
        )}
        {row.sourcing_layer_name && (
          <span className="text-[10px] text-muted-foreground">{row.sourcing_layer_name}</span>
        )}
      </div>
    ),
    className: "w-[150px]",
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge status={row.status} />,
    className: "w-[130px]",
  },
  {
    key: "cadence",
    header: "Schedule",
    cell: (row) => cadenceLabel(row),
    className: "w-[150px]",
  },
  {
    key: "primary_contact",
    header: "Primary Contact",
    cell: (row) =>
      row.primary_contact ? (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium truncate">{row.primary_contact.contact_person}</span>
          {row.primary_contact.designation && (
            <span className="text-xs text-muted-foreground truncate">
              {row.primary_contact.designation}
            </span>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
    className: "w-[180px]",
  },
  {
    key: "hq",
    header: "HQ",
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{row.hq ?? "—"}</span>
    ),
    className: "w-[100px]",
  },
];

// ── Instrument tile — the quick numeric read, echoing the Schedule triage chips ──

function SummaryTile({
  label,
  value,
  hint,
  tone,
  dotClass,
  pulse,
  isPercent,
}: {
  label: string;
  value: number | null;
  hint?: string;
  tone?: string;
  dotClass: string;
  pulse?: boolean;
  isPercent?: boolean;
}) {
  const counted = useCounter(value);
  const shown =
    value === null ? "—" : isPercent ? `${counted ?? value}%` : (counted ?? value);
  return (
    <div className={cn("flex flex-col bg-card px-4 py-3.5")} data-alert={pulse || undefined}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden />
        {label}
      </span>
      <span
        className={cn("mt-1 text-2xl font-semibold leading-8 tabular-nums tracking-[-0.01em]", tone)}
        style={DISPLAY}
      >
        {shown}
      </span>
      {hint && <span className="mt-1.5 text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CompanyStatus | "">("");
  const [type, setType] = useState<CompanyType | "">("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  // Honor a ?mandate_id= deep-link (e.g. from a mandate detail page). Read after mount
  // (not in a useState initializer) so server and client first render match — avoids a
  // hydration mismatch on /companies?mandate_id=X.
  const [mandateId, setMandateId] = useState<number | undefined>(undefined);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("mandate_id");
    if (v) setMandateId(Number(v));
  }, []);

  const filters: CompanyFilters = {
    q: search || undefined,
    status: status || undefined,
    type: type || undefined,
    mandate_id: mandateId,
    include_archived: includeArchived || undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const { data, isLoading, error } = useCompanies(filters);

  const summary = data?.summary;
  const total = data?.total ?? 0;
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const hasFilters = Boolean(search || status || type);

  // Toggle a status filter from the composition bar / legend (clears if re-clicked).
  const toggleStatus = (s: CompanyStatus) => {
    setStatus((cur) => (cur === s ? "" : s));
    setPage(1);
  };

  // Status composition of the current result set — the page's signature read.
  const byStatus = summary?.by_status;
  const statusTotal = byStatus
    ? STATUS_ORDER.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0)
    : 0;
  const segments = byStatus
    ? STATUS_ORDER.map((s) => ({ status: s, count: byStatus[s] ?? 0 })).filter(
        (seg) => seg.count > 0,
      )
    : [];

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setType("");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Companies"
        description="Every Master List row across your mandates — targets, buyers and investors in one place."
        actions={
          <AddCompanyDialog
            mandateId={mandateId}
            trigger={<Button size="sm">New company</Button>}
          />
        }
      />

      {/* Instrument panel — the quick numeric read */}
      {summary && (
        <div className="grid gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border grid-cols-2 sm:grid-cols-4">
          <SummaryTile
            label="Total"
            value={total}
            hint={total === 1 ? "company" : "companies"}
            dotClass="bg-ink-300"
          />
          <SummaryTile
            label="Needs first outreach"
            value={summary.needs_initial_count}
            hint="awaiting initial email"
            tone="text-foreground"
            dotClass="bg-card ring-1 ring-inset ring-ink-400"
          />
          <SummaryTile
            label="Overdue"
            value={summary.overdue_count}
            hint={summary.overdue_count > 0 ? "follow-up past due" : "all on schedule"}
            tone={summary.overdue_count > 0 ? "text-danger-ink" : undefined}
            dotClass="bg-danger"
            pulse={summary.overdue_count > 0}
          />
          <SummaryTile
            label="Responded"
            value={Math.round(summary.responded_pct * 100)}
            isPercent
            hint="of contacted companies"
            tone="text-foreground"
            dotClass="bg-success"
          />
        </div>
      )}

      {/* Status composition — the signature: a proportional read of the set, and a filter */}
      {statusTotal > 0 && (
        <div className="rounded-lg bg-card px-4 py-3 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Status mix
            </span>
            {status && (
              <button
                onClick={() => toggleStatus(status)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-ink hover:underline"
              >
                Clear
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div
            className="mt-2.5 flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted"
            /* Each segment is a filter button, so this is a group of controls — it
               was declared role="img", which may not contain focusable children. */
            role="group"
            aria-label="Filter companies by status"
          >
            {segments.map((seg) => {
              const meta = SPECTRUM[seg.status];
              const dim = status !== "" && status !== seg.status;
              return (
                <button
                  key={seg.status}
                  onClick={() => toggleStatus(seg.status)}
                  title={`${meta.label}: ${seg.count}`}
                  aria-label={`Filter by ${meta.label} (${seg.count})`}
                  className="h-full min-w-[3px] transition-opacity hover:opacity-100"
                  style={{
                    width: `${(seg.count / statusTotal) * 100}%`,
                    background: meta.color,
                    opacity: dim ? 0.3 : 1,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {segments.map((seg) => {
              const meta = SPECTRUM[seg.status];
              const active = status === seg.status;
              return (
                <button
                  key={seg.status}
                  onClick={() => toggleStatus(seg.status)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
                    active
                      ? "border-border-strong bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: meta.color }}
                    aria-hidden
                  />
                  {meta.label}
                  <span className="font-semibold tabular-nums text-foreground">{seg.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8"
          />
        </div>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as CompanyStatus | ""); setPage(1); }}
          className={SELECT_CLS}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => { setType(e.target.value as CompanyType | ""); setPage(1); }}
          className={SELECT_CLS}
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:text-foreground has-[:checked]:border-border-strong has-[:checked]:bg-accent has-[:checked]:text-foreground">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1); }}
            className="h-3.5 w-3.5 rounded accent-primary"
          />
          Archived
        </label>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Clear filters
            <X className="h-3 w-3" />
          </button>
        )}

        {mandateId && (
          <button
            onClick={() => router.push("/companies")}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-accent px-2.5 text-xs font-medium text-foreground"
          >
            Mandate #{mandateId}
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Source legend — keys the coloured dots in the Company column */}
        <div className="ml-auto hidden items-center gap-3 text-[11px] text-muted-foreground lg:flex">
          {SOURCE_META.map((s) => (
            <span key={s.value} className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data?.items}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRowClick={(row) => router.push(`/companies/${row.id}`)}
        emptyState={
          <EmptyState
            icon={Building2}
            title="No companies"
            // This page spans every engagement, so there is no "this mandate" to add to
            // — on a fresh firm the honest next step is bringing the book in at all.
            description={
              hasFilters
                ? "Try adjusting your filters."
                : "Nothing on your desk yet — add a company, or import a client workbook."
            }
          />
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground tabular-nums">
            {total} companies
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-2 text-muted-foreground tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
