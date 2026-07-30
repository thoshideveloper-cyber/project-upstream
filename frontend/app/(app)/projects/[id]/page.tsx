"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronRight,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Reply,
  PhoneCall,
  Search,
  Target,
  Users,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/components/features/confirm-dialog";
import { toastUndo } from "@/lib/undo-toast";

import { useProject, useArchiveProject, useUpdateProject } from "@/hooks/use-projects";
import { useMandate, useAssignUser, useUnassignUser } from "@/hooks/use-mandates";
import { useCompanies } from "@/hooks/use-companies";
import { useCategories } from "@/hooks/use-categories";
import { useSourcingLayers } from "@/hooks/use-sourcing-layers";
import { useUsers } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { MandateDialog } from "@/components/features/mandate-dialog";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { AddCompanyDialog } from "@/components/features/add-company";
import { TableSkeleton } from "@/components/features/table-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEAL_TYPE_SHORT,
  DEAL_TYPE_STYLE,
  DISPLAY,
  LABEL,
  MONO,
  RECORD_TITLE,
  RECORD_TITLE_STYLE,
  SELECT_CLS,
  STATUS_META,
  TH_CLS,
} from "@/lib/design";
import { cn } from "@/lib/utils";
import type {
  Company,
  CompanyStatus,
  MandateEngagementStats,
  MandateType,
} from "@/types";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTH[m - 1]}` : iso;
}

// Engagement lifecycle — dot + lowercase label; ACTIVE is the silent default.
const MANDATE_STATUS_META: Record<string, { label: string; dot: string } | null> = {
  ACTIVE: null,
  ON_HOLD: { label: "on hold", dot: "bg-amber-500" },
  CLOSED: { label: "closed", dot: "bg-muted-foreground/50" },
  TERMINATED: { label: "terminated", dot: "bg-destructive" },
};

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.label]),
);

// Band (sourcing layer) accents + category dots — small deterministic palettes.
// Drawn from the app's chart tokens, not raw hex, so bands stay in the product's
// closed hue set and re-tune with the theme.
const BAND_COLORS = [
  "var(--primary)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];
const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

const UNSORTED = "Unsorted";
const COLS = 6;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const GROUP_BY_OPTIONS = [
  { value: "band-category", label: "Group: Band → Category" },
  { value: "category", label: "Group: Category" },
  { value: "status", label: "Group: Status" },
  { value: "none", label: "Group: None" },
] as const;
type GroupBy = (typeof GROUP_BY_OPTIONS)[number]["value"];

function needsAttention(c: Company): boolean {
  return (c.is_overdue && !c.is_cold) || c.schedule_status === "AWAITING_INITIAL";
}

// ── Team dialog — assignments, relocated from the old mandate detail, kept quiet ──

function TeamDialog({
  mandateId,
  mandateName,
  open,
  onOpenChange,
}: {
  mandateId: number;
  mandateName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: mandate } = useMandate(mandateId);
  const { data: users } = useUsers();
  const assign = useAssignUser();
  const unassign = useUnassignUser();
  const [selected, setSelected] = useState("");

  const assigned = mandate?.assignments ?? [];
  const assignedIds = new Set(assigned.map((a) => a.id));
  const assignable = (users?.items ?? []).filter((u) => !assignedIds.has(u.id));

  const handleAssign = async () => {
    if (!selected) return;
    try {
      await assign.mutateAsync({ mandateId, userId: Number(selected) });
      toast.success("Analyst assigned");
      setSelected("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Team — {mandateName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one assigned yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {assigned.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg px-1 py-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                      {initials(a.full_name)}
                    </span>
                    <span className="font-medium">{a.full_name}</span>
                    <span className="text-xs capitalize text-muted-foreground">{a.role.toLowerCase()}</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await unassign.mutateAsync({ mandateId, userId: a.id });
                        toast.success("Removed");
                      } catch {
                        toast.error("Failed to remove");
                      }
                    }}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive-ink"
                    aria-label={`Remove ${a.full_name}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {assignable.length > 0 && (
            <div className="flex gap-2 border-t border-border pt-3">
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className={cn(SELECT_CLS, "flex-1")}>
                <option value="">Assign someone…</option>
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role.toLowerCase()})
                  </option>
                ))}
              </select>
              <Button onClick={handleAssign} disabled={!selected || assign.isPending}>
                <UserPlus className="mr-1 h-4 w-4" aria-hidden />
                Assign
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit-project dialog (kept from the old detail page, restyled trigger) ────────

function EditProjectDialog({
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
  // Mounted only while open (see call site), so these initializers are always fresh.
  const [name, setName] = useState(currentName);
  const [clientName, setClientName] = useState(currentClientName);
  const update = useUpdateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: projectId, data: { name: name.trim(), client_name: clientName.trim() } });
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
            <Input id="edit-proj-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-proj-client">Client name</Label>
            <Input id="edit-proj-client" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
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

// ── Book rail cell — the deal room's signature instrument ────────────────────────

function BookCell({
  eng,
  active,
  maxTotal,
  delay,
  onSelect,
}: {
  eng: MandateEngagementStats;
  active: boolean;
  maxTotal: number;
  delay: number;
  onSelect: () => void;
}) {
  const total = eng.total_companies;
  const late = eng.overdue_count;
  const fresh = eng.needs_initial_count;
  const replied = eng.responded;
  const cold = eng.cold_count;
  const widthPct = maxTotal > 0 && total > 0 ? Math.max(8, (total / maxTotal) * 100) : 0;
  const statusMeta = MANDATE_STATUS_META[eng.status];

  // Underbar segments in a fixed, meaningful order — the active remainder last.
  const activeCount = Math.max(0, total - late - fresh - replied - cold);
  const segs: { key: string; n: number; cls: string }[] = [
    { key: "late", n: late, cls: "bg-destructive" },
    { key: "awaiting", n: fresh, cls: "bg-indigo-500/80" },
    { key: "replied", n: replied, cls: "bg-emerald-500/80" },
    { key: "cold", n: cold, cls: "bg-muted-foreground/25" },
    { key: "active", n: activeCount, cls: "bg-foreground/25" },
  ];

  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex min-w-[200px] flex-1 flex-col gap-1 rounded-md px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-card shadow-sm ring-1 ring-border" : "hover:bg-card/60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-medium", DEAL_TYPE_STYLE[eng.type])}>
          {DEAL_TYPE_SHORT[eng.type]}
        </span>
        {statusMeta && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} aria-hidden />
            {statusMeta.label}
          </span>
        )}
      </div>
      <span className={cn("truncate text-[13px] font-semibold tracking-tight", active ? "text-foreground" : "text-foreground/80")} title={eng.name}>
        {eng.name}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground" style={MONO}>
        {total} {total === 1 ? "company" : "companies"}
        {late > 0 && <span className="text-destructive-ink"> · {late} late</span>}
        {fresh > 0 && <span className="text-indigo-600 dark:text-indigo-400"> · {fresh} new</span>}
      </span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
        <span
          className="horizon-load flex h-full overflow-hidden rounded-full"
          style={{ width: `${widthPct}%`, "--load-delay": `${delay}ms` } as React.CSSProperties}
        >
          {total > 0 &&
            segs.map((s) =>
              s.n > 0 ? (
                <span key={s.key} className={cn("h-full", s.cls)} style={{ width: `${(s.n / total) * 100}%` }} />
              ) : null,
            )}
        </span>
      </span>
    </button>
  );
}

// ── Company grid mechanics (ported from the old grid page, restyled) ─────────────

interface SubGroup {
  key: string;
  label: string | null;
  categoryId: number | null;
  color: string | null;
  companies: Company[];
}
interface Band {
  key: string;
  label: string | null;
  layerId: number | null;
  subgroups: SubGroup[];
  count: number;
}

function orderedCategoryGroups(companies: Company[], categoryOrder: number[]): SubGroup[] {
  const byCat = new Map<number | null, Company[]>();
  for (const c of companies) {
    const key = c.category_id ?? null;
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(c);
  }
  const keys = [...byCat.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
  });
  return keys.map((k) => {
    const list = byCat.get(k)!;
    const idx = k == null ? -1 : categoryOrder.indexOf(k);
    return {
      key: `cat-${k ?? "none"}`,
      label: list[0]?.category_name ?? "Uncategorized",
      categoryId: k,
      color: k == null ? null : CATEGORY_COLORS[((idx >= 0 ? idx : 0) + CATEGORY_COLORS.length) % CATEGORY_COLORS.length],
      companies: list,
    };
  });
}

// ── Next-touch cell — the cadence, spoken in register language ──────────────────

function NextTouch({ c }: { c: Company }) {
  const days = c.days_remaining;
  if (c.is_cold) {
    return (
      <span className="text-xs text-muted-foreground" style={MONO} title={`Follow-up cap reached after ${c.cycle_number ?? 1} cycle(s)`}>
        cold
      </span>
    );
  }
  if (c.schedule_status === "AWAITING_INITIAL") {
    return (
      <span className="text-xs text-indigo-600 dark:text-indigo-400" style={MONO} title="Awaiting the first email — the clock hasn't started">
        intro pending
      </span>
    );
  }
  if (c.is_overdue) {
    return (
      <span className="text-xs font-semibold text-destructive-ink" style={MONO} title={c.next_due_date ? `Was due ${fmtDate(c.next_due_date)}` : undefined}>
        {Math.abs(days ?? 0)}d late
      </span>
    );
  }
  if (c.schedule_status === "ACTIVE" && days != null && days <= 7) {
    return (
      <span className="text-xs font-medium text-primary-ink" style={MONO} title={days === 0 ? "Due today" : `Due in ${days} days`}>
        {days === 0 ? "today" : `${days}d`} · {fmtDate(c.next_due_date)}
      </span>
    );
  }
  if (c.schedule_status === "ACTIVE" && c.next_due_date) {
    return (
      <span className="text-xs text-muted-foreground" style={MONO} title={days != null ? `Due in ${days} days` : undefined}>
        {fmtDate(c.next_due_date)}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground" style={MONO} title="Cadence stopped">
      —
    </span>
  );
}

// ── Row actions — contextual primary + quick outcomes, quiet until hover ─────────

function RowActions({ company }: { company: Company }) {
  const awaiting = company.schedule_status === "AWAITING_INITIAL";
  const running = !company.is_cold && (company.schedule_status === "ACTIVE" || awaiting);
  const [quickType, setQuickType] = useState<string | null>(null);

  if (!running) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground opacity-60 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 lg:opacity-0"
              aria-label={`Actions for ${company.company_name}`}
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={`/companies/${company.id}`} />}>
            <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden /> Open dossier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      <LogOutreachDialog
        companyId={company.id}
        companyName={company.company_name}
        defaultEventType={awaiting ? "INITIAL_EMAIL" : "FOLLOW_UP"}
        trigger={
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-r-none pr-2.5 text-xs font-normal transition-colors group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground"
            data-testid={`log-touch-${company.id}`}
          >
            {awaiting ? "Send intro" : "Follow-up"}
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="outline"
              className="-ml-px h-7 w-6 rounded-l-none px-0 transition-colors group-hover:border-primary/40"
              aria-label="More outcomes"
            />
          }
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setQuickType("RESPONSE")}>
            <Reply className="h-4 w-4 text-emerald-500" aria-hidden /> Mark replied
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickType("BOUNCE")}>
            <XCircle className="h-4 w-4 text-destructive-ink" aria-hidden /> Mark bounced
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setQuickType("CALL")}>
            <PhoneCall className="h-4 w-4 text-muted-foreground" aria-hidden /> Log call
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickType("MEETING")}>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> Log meeting
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href={`/companies/${company.id}`} />}>
            <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden /> Open dossier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {quickType !== null && (
        <LogOutreachDialog
          key={quickType}
          companyId={company.id}
          companyName={company.company_name}
          defaultEventType={quickType}
          open
          onOpenChange={(o) => !o && setQuickType(null)}
          trigger={null}
        />
      )}
    </div>
  );
}

// ── Company row ─────────────────────────────────────────────────────────────────

function CompanyRow({ company, showCategory }: { company: Company; showCategory: boolean }) {
  const status = STATUS_META[company.status] ?? STATUS_META.NOT_CONTACTED;
  return (
    <tr className="grid-row group border-t border-border hover:bg-muted/30" data-testid="grid-company-row">
      <td className="max-w-0 px-3 py-2">
        <Link
          href={`/companies/${company.id}`}
          className="block truncate text-sm font-medium text-foreground outline-none hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          {company.company_name}
        </Link>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {company.hq ?? "—"}
          {showCategory && company.category_name ? ` · ${company.category_name}` : ""}
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-muted-foreground xl:table-cell" style={MONO}>
        {company.revenue_inr_cr ? `₹${Number(company.revenue_inr_cr).toLocaleString("en-IN")}` : "—"}
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} aria-hidden />
          {status.label}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <NextTouch c={company} />
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-muted-foreground lg:table-cell">
        {company.primary_contact ? (
          <span className="block max-w-[10rem] truncate" title={company.primary_contact.email ?? undefined}>
            {company.primary_contact.contact_person}
          </span>
        ) : (
          <span className="italic text-muted-foreground">No contact</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <RowActions company={company} />
      </td>
    </tr>
  );
}

// ── Sub-group + band sections ────────────────────────────────────────────────────

function SubGroupBody({
  sub,
  mandateId,
  layerId,
  exchangeRate,
  mandateName,
  mandateType,
  showHeader,
  flattened,
}: {
  sub: SubGroup;
  mandateId: number;
  layerId: number | null;
  exchangeRate: number | null;
  mandateName?: string;
  mandateType?: MandateType;
  showHeader: boolean;
  flattened: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const late = sub.companies.filter((c) => c.is_overdue && !c.is_cold).length;

  return (
    <>
      {showHeader && sub.label !== null && (
        <tr className="bg-muted/20">
          <td colSpan={COLS} className="px-3 py-1 pl-9">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="flex min-w-0 items-center gap-1.5 text-left text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform", !collapsed && "rotate-90")} aria-hidden />
                {sub.color != null ? (
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sub.color }} />
                ) : sub.categoryId === null && !flattened ? (
                  <span className="h-2 w-2 shrink-0 rounded-full border border-muted-foreground/40" />
                ) : null}
                <span className="truncate text-xs font-medium text-foreground/80">{sub.label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground" style={MONO}>{sub.companies.length}</span>
                {late > 0 && (
                  <span className="ml-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-destructive-ink">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {late}
                  </span>
                )}
              </button>
              <div className="ml-auto">
                <AddCompanyDialog
                  mandateId={mandateId}
                  mandateName={mandateName}
                  mandateType={mandateType}
                  exchangeRate={exchangeRate}
                  defaultSourcingLayerId={layerId}
                  defaultCategoryId={sub.categoryId}
                  trigger={
                    <button
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={`Add company to ${sub.label}`}
                      data-testid={`inline-add-${sub.key}`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  }
                />
              </div>
            </div>
          </td>
        </tr>
      )}
      {!collapsed && sub.companies.map((c) => <CompanyRow key={c.id} company={c} showCategory={flattened} />)}
    </>
  );
}

function BandSection(props: {
  band: Band;
  color: string;
  mandateId: number;
  exchangeRate: number | null;
  mandateName?: string;
  mandateType?: MandateType;
  showBandHeader: boolean;
  showSubHeader: boolean;
  flattened: boolean;
}) {
  const { band, color, mandateId, exchangeRate, mandateName, mandateType, showBandHeader, showSubHeader, flattened } = props;
  const [collapsed, setCollapsed] = useState(false);
  const all = useMemo(() => band.subgroups.flatMap((s) => s.companies), [band]);
  const late = all.filter((c) => c.is_overdue && !c.is_cold).length;
  const fresh = all.filter((c) => c.schedule_status === "AWAITING_INITIAL").length;

  return (
    <tbody>
      {showBandHeader && (
        <tr className="sticky top-[33px] z-[5]">
          <td colSpan={COLS} className="p-0">
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-card/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80"
              style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
            >
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="flex min-w-0 items-center gap-2 text-left transition-colors hover:text-foreground"
              >
                <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !collapsed && "rotate-90")} aria-hidden />
                <span className="truncate text-sm font-semibold tracking-tight">{band.label}</span>
                <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground" style={MONO}>
                  {all.length}
                </span>
              </button>
              <div className="flex items-center gap-2 text-[11px]">
                {late > 0 && (
                  <span className="inline-flex items-center gap-0.5 font-medium text-destructive-ink">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {late} late
                  </span>
                )}
                {fresh > 0 && <span className="text-indigo-600 dark:text-indigo-400">{fresh} intro pending</span>}
              </div>
              <div className="ml-auto">
                <AddCompanyDialog
                  mandateId={mandateId}
                  mandateName={mandateName}
                  mandateType={mandateType}
                  exchangeRate={exchangeRate}
                  defaultSourcingLayerId={band.layerId}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" data-testid={`inline-add-band-${band.key}`}>
                      <Plus className="mr-1 h-3 w-3" aria-hidden /> Add
                    </Button>
                  }
                />
              </div>
            </div>
          </td>
        </tr>
      )}
      {!collapsed &&
        band.subgroups.map((sub) => (
          <SubGroupBody
            key={sub.key}
            sub={sub}
            mandateId={mandateId}
            layerId={band.layerId}
            exchangeRate={exchangeRate}
            mandateName={mandateName}
            mandateType={mandateType}
            showHeader={showSubHeader}
            flattened={flattened}
          />
        ))}
    </tbody>
  );
}

// ── The book grid (the selected engagement's working table) ──────────────────────

function BookGrid({
  mandateId,
  mandateName,
}: {
  mandateId: number;
  mandateName: string;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>("band-category");
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const { data: mandate } = useMandate(mandateId);
  const { data: layersData } = useSourcingLayers(mandateId);
  const { data: categoriesData } = useCategories();
  const { data, isLoading, isError, refetch } = useCompanies({
    mandate_id: mandateId,
    page_size: 200,
    sort: "company_name",
  });

  const categoryOrder = useMemo(() => (categoriesData?.items ?? []).map((c) => c.id), [categoriesData]);
  const exchangeRate = mandate?.exchange_rate ? Number(mandate.exchange_rate) : null;

  const attentionCount = useMemo(() => (data?.items ?? []).filter(needsAttention).length, [data]);

  const filteredCompanies = useMemo(() => {
    let all = data?.items ?? [];
    if (attentionOnly) all = all.filter(needsAttention);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => {
      const haystack = [
        c.company_name,
        c.hq,
        c.category_name,
        c.sourcing_layer_name,
        c.primary_contact?.contact_person,
        c.primary_contact?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search, attentionOnly]);

  const bands: Band[] = useMemo(() => {
    const companies = filteredCompanies;
    if (groupBy === "none") {
      return [
        {
          key: "all",
          label: null,
          layerId: null,
          count: companies.length,
          subgroups: [{ key: "all", label: null, categoryId: null, color: null, companies }],
        },
      ];
    }
    if (groupBy === "category") {
      const subs = orderedCategoryGroups(companies, categoryOrder);
      return [{ key: "all", label: null, layerId: null, count: companies.length, subgroups: subs }];
    }
    if (groupBy === "status") {
      const byStatus = new Map<string, Company[]>();
      for (const c of companies) {
        if (!byStatus.has(c.status)) byStatus.set(c.status, []);
        byStatus.get(c.status)!.push(c);
      }
      const subs: SubGroup[] = [...byStatus.entries()].map(([s, list]) => ({
        key: `status-${s}`,
        label: STATUS_LABELS[s] ?? s,
        categoryId: null,
        color: null,
        companies: list,
      }));
      return [{ key: "all", label: null, layerId: null, count: companies.length, subgroups: subs }];
    }
    // band-category (default)
    const byLayer = new Map<number | null, Company[]>();
    for (const c of companies) {
      const key = c.sourcing_layer_id ?? null;
      if (!byLayer.has(key)) byLayer.set(key, []);
      byLayer.get(key)!.push(c);
    }
    const orderedLayers = layersData?.items ?? [];
    const result: Band[] = [];
    for (const layer of orderedLayers) {
      const list = byLayer.get(layer.id) ?? [];
      result.push({
        key: `layer-${layer.id}`,
        label: layer.name,
        layerId: layer.id,
        count: list.length,
        subgroups: orderedCategoryGroups(list, categoryOrder),
      });
      byLayer.delete(layer.id);
    }
    for (const [layerId, list] of byLayer.entries()) {
      if (layerId === null) continue;
      result.push({
        key: `layer-${layerId}`,
        label: list[0]?.sourcing_layer_name ?? "Layer",
        layerId,
        count: list.length,
        subgroups: orderedCategoryGroups(list, categoryOrder),
      });
    }
    const unsorted = byLayer.get(null) ?? [];
    result.push({
      key: "unsorted",
      label: UNSORTED,
      layerId: null,
      count: unsorted.length,
      subgroups: orderedCategoryGroups(unsorted, categoryOrder),
    });
    return result.filter((b) => b.count > 0);
  }, [filteredCompanies, groupBy, layersData, categoryOrder]);

  const showBandHeader = groupBy === "band-category";
  const showSubHeader = groupBy !== "none";
  const flattened = groupBy === "none" || groupBy === "status";

  const summary = data?.summary;
  const total = data?.total ?? 0;
  const filtering = !!search || attentionOnly;

  return (
    <div className="flex flex-col gap-3">
      {/* Book toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search companies in this book"
            data-testid="grid-search"
            className="h-9 w-40 pl-8 pr-8 transition-[width] focus:w-56"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <button
          onClick={() => setAttentionOnly((v) => !v)}
          aria-pressed={attentionOnly}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
            attentionOnly
              ? "border-primary/50 bg-primary/10 text-primary-ink"
              : "border-input text-muted-foreground hover:text-foreground",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Needs attention
          {attentionCount > 0 && <span className="tabular-nums" style={MONO}>· {attentionCount}</span>}
        </button>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className={SELECT_CLS}
          data-testid="group-by"
          aria-label="Group companies by"
        >
          {GROUP_BY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/schedule?deal=${mandateId}`}
            className="text-xs font-medium text-primary-ink hover:underline"
            title="Open the outreach desk scoped to this engagement"
          >
            Work queue →
          </Link>
          <AddCompanyDialog
            mandateId={mandateId}
            mandateName={mandateName}
            mandateType={mandate?.type}
            exchangeRate={exchangeRate}
            trigger={
              <Button>
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Add company
              </Button>
            }
          />
        </div>
      </div>

      {/* Summary caption */}
      {summary && total > 0 && (
        <p className="text-xs text-muted-foreground">
          {filtering ? (
            <>
              <span className="font-medium tabular-nums text-foreground" style={MONO}>{filteredCompanies.length}</span> of{" "}
              <span className="tabular-nums" style={MONO}>{total}</span> shown ·{" "}
              <button
                onClick={() => {
                  setSearch("");
                  setAttentionOnly(false);
                }}
                className="text-primary-ink hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <span className="font-medium tabular-nums text-foreground" style={MONO}>{total}</span> companies ·{" "}
              <span className="tabular-nums" style={MONO}>{Math.round(summary.responded_pct * 100)}%</span> replied
              {summary.overdue_count > 0 && (
                <span className="text-destructive-ink"> · <span className="tabular-nums" style={MONO}>{summary.overdue_count}</span> late</span>
              )}
              {summary.needs_initial_count > 0 && (
                <span className="text-indigo-600 dark:text-indigo-400"> · <span className="tabular-nums" style={MONO}>{summary.needs_initial_count}</span> intro pending</span>
              )}
            </>
          )}
        </p>
      )}

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden />
            <p className="text-sm font-medium">Couldn&rsquo;t load this book.</p>
            <button onClick={() => refetch()} className="text-xs font-medium text-primary-ink hover:underline">
              Try again
            </button>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="text-sm font-medium">This book is empty.</p>
            <div className="flex items-center gap-3">
              <AddCompanyDialog
                mandateId={mandateId}
                mandateName={mandateName}
                mandateType={mandate?.type}
                exchangeRate={exchangeRate}
                trigger={
                  <Button size="sm">
                    <Plus className="mr-1 h-4 w-4" aria-hidden />
                    Add the first company
                  </Button>
                }
              />
              <Link href="/sourcing" className="inline-flex items-center gap-1 text-xs text-primary-ink hover:underline">
                <Target className="h-3.5 w-3.5" aria-hidden /> Discover targets
              </Link>
            </div>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">
            {attentionOnly && !search ? (
              <>
                Nothing needs attention right now — no late or unstarted outreach.{" "}
                <button onClick={() => setAttentionOnly(false)} className="text-primary-ink hover:underline">
                  Show all
                </button>
              </>
            ) : (
              <>
                No companies match <span className="font-medium text-foreground">&ldquo;{search}&rdquo;</span>.{" "}
                <button
                  onClick={() => {
                    setSearch("");
                    setAttentionOnly(false);
                  }}
                  className="text-primary-ink hover:underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm" data-testid="grid-table">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className={cn(TH_CLS, "w-full")}>Company</th>
                <th className={cn(TH_CLS, "hidden text-right xl:table-cell")}>Rev ₹Cr</th>
                <th className={cn(TH_CLS, "hidden md:table-cell")}>Status</th>
                <th className={TH_CLS}>Next touch</th>
                <th className={cn(TH_CLS, "hidden lg:table-cell")}>Contact</th>
                <th className={cn(TH_CLS, "text-right")}></th>
              </tr>
            </thead>
            {bands.map((band, i) => (
              <BandSection
                key={band.key}
                band={band}
                color={band.key === "unsorted" ? "var(--muted-foreground)" : BAND_COLORS[i % BAND_COLORS.length]}
                mandateId={mandateId}
                exchangeRate={exchangeRate}
                mandateName={mandateName}
                mandateType={mandate?.type}
                showBandHeader={showBandHeader}
                showSubHeader={showSubHeader}
                flattened={flattened}
              />
            ))}
          </table>
        )}
      </div>
    </div>
  );
}

// ── Empty engagements invitation ─────────────────────────────────────────────────

function NoEngagements({
  projectId,
  clientName,
}: {
  projectId: number;
  clientName: string;
}) {
  const [dialogType, setDialogType] = useState<MandateType | null>(null);
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <FolderOpen className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium">No engagements in this project yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Open the first book — sell-side, buy-side, or a capital raise under {clientName}.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {(["SELL_SIDE", "BUY_SIDE", "CAPITAL_RAISE"] as MandateType[]).map((t) => (
          <Button key={t} size="sm" variant="outline" onClick={() => setDialogType(t)}>
            {t === "SELL_SIDE" ? "Sell-side" : t === "BUY_SIDE" ? "Buy-side" : "Capital raise"}
          </Button>
        ))}
      </div>
      {dialogType && (
        <MandateDialog
          key={dialogType}
          projectId={projectId}
          defaultClientName={clientName}
          defaultType={dialogType}
          open
          onOpenChange={(o) => !o && setDialogType(null)}
          trigger={null}
        />
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function DealRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";

  const { data: project, isLoading, error } = useProject(projectId);
  const archive = useArchiveProject();
  const confirm = useConfirm();

  // `book` holds an explicit user choice (0 = none yet). The rendered selection is
  // DERIVED — never stored via an effect — so the default falls back cleanly to the
  // first overdue book, else the first, without a setState-in-effect cascade.
  const [book, setBook] = useState<number>(() => Number(searchParams.get("book")) || 0);
  const [addEngagementOpen, setAddEngagementOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [teamFor, setTeamFor] = useState<{ id: number; name: string } | null>(null);
  const [editEngagement, setEditEngagement] = useState(false);

  const allEngagements = useMemo<MandateEngagementStats[]>(() => {
    if (!project) return [];
    return [
      ...project.engagements.SELL_SIDE,
      ...project.engagements.BUY_SIDE,
      ...project.engagements.CAPITAL_RAISE,
    ];
  }, [project]);

  const effectiveBook = useMemo(() => {
    if (allEngagements.length === 0) return 0;
    if (allEngagements.some((e) => e.id === book)) return book;
    const firstLate = allEngagements.find((e) => e.overdue_count > 0);
    return (firstLate ?? allEngagements[0]).id;
  }, [allEngagements, book]);

  // Reflect the resolved selection in the URL (external system → allowed in an effect).
  useEffect(() => {
    if (effectiveBook > 0) {
      window.history.replaceState(null, "", `/projects/${projectId}?book=${effectiveBook}`);
    }
  }, [effectiveBook, projectId]);

  const selected = allEngagements.find((e) => e.id === effectiveBook);
  const { data: selectedMandate } = useMandate(effectiveBook);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        <div className="space-y-2">
          <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-[76px] animate-pulse rounded-xl bg-muted" />
        <TableSkeleton cols={2} rows={6} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden />
        <p className="text-sm font-medium">Project not found.</p>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-primary-ink hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to projects
        </Link>
      </div>
    );
  }

  const archived = !!project.archived_at;
  const { headline } = project;
  const showClient = project.client_name.trim() !== project.name.trim();
  const engagementTotal = allEngagements.length;

  // Team — union of engagement analysts across the whole project.
  const team = (() => {
    const map = new Map<number, string>();
    for (const e of allEngagements) for (const a of e.analysts ?? []) map.set(a.id, a.full_name);
    return [...map.values()].sort();
  })();

  const maxTotal = Math.max(1, ...allEngagements.map((e) => e.total_companies));
  const replied = Math.round((headline.response_rate ?? 0) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link href="/projects" className="group -ml-2 inline-flex items-center rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
          Projects
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAddEngagementOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add engagement
          </Button>
          {isPartner && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="Project actions" />}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden /> Edit project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    const verb = archived ? "restore" : "archive";
                    const ok = await confirm({
                      title: archived ? `Restore "${project.name}"?` : `Archive "${project.name}"?`,
                      description: archived
                        ? "It returns to the deal floor with its engagements intact."
                        : "The project and its engagements drop off the deal floor. Nothing is destroyed — undo straight after, or restore from the archived filter.",
                      confirmLabel: archived ? "Restore" : "Archive",
                      tone: archived ? "default" : "destructive",
                    });
                    if (!ok) return;
                    try {
                      await archive.mutateAsync({ id: project.id, archived });
                      if (archived) {
                        toast.success("Project restored");
                      } else {
                        toastUndo(`"${project.name}" archived`, () =>
                          archive.mutateAsync({ id: project.id, archived: true }),
                        );
                        router.push("/projects");
                      }
                    } catch {
                      toast.error(`Failed to ${verb} project`);
                    }
                  }}
                >
                  {archived ? (
                    <><ArchiveRestore className="h-4 w-4 text-muted-foreground" aria-hidden /> Restore project</>
                  ) : (
                    <><Archive className="h-4 w-4 text-muted-foreground" aria-hidden /> Archive project</>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Masthead */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {showClient && (
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
              <span className="truncate">{project.client_name}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={RECORD_TITLE} style={RECORD_TITLE_STYLE}>
              {project.name}
            </h1>
            {archived && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Archived</span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="tabular-nums" style={MONO}>{engagementTotal}</span>{" "}
            {engagementTotal === 1 ? "engagement" : "engagements"} ·{" "}
            <span className="tabular-nums" style={MONO}>{headline.total_companies}</span> companies ·{" "}
            <span className="tabular-nums" style={MONO}>{replied}%</span> replied
            {headline.overdue_count > 0 && (
              <span className="font-medium text-destructive-ink"> · <span className="tabular-nums" style={MONO}>{headline.overdue_count}</span> late</span>
            )}
            {(headline.needs_initial_count ?? 0) > 0 && (
              <span className="text-indigo-600 dark:text-indigo-400"> · <span className="tabular-nums" style={MONO}>{headline.needs_initial_count}</span> intro pending</span>
            )}
            {headline.last_activity && (
              <> · Last activity <span className="tabular-nums" style={MONO}>{fmtDate(headline.last_activity)}</span></>
            )}
          </p>
        </div>

        {team.length > 0 && (
          <div className="shrink-0 text-right">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team</p>
            <div className="flex items-center justify-end" title={team.join(", ")}>
              <div className="flex -space-x-1.5">
                {team.slice(0, 4).map((name) => (
                  <span
                    key={name}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground"
                  >
                    {initials(name)}
                  </span>
                ))}
              </div>
              {team.length > 4 && (
                <span className="ml-1 text-[10px] tabular-nums text-muted-foreground" style={MONO}>+{team.length - 4}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Books + grid, or the empty invitation */}
      {engagementTotal === 0 ? (
        <NoEngagements projectId={project.id} clientName={project.client_name} />
      ) : (
        <>
          {/* Book rail (signature) */}
          <div
            role="tablist"
            aria-label="Engagement books"
            className="flex items-stretch gap-0.5 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1"
          >
            {allEngagements.map((eng, i) => (
              <BookCell
                key={eng.id}
                eng={eng}
                active={eng.id === effectiveBook}
                maxTotal={maxTotal}
                delay={i * 40}
                onSelect={() => setBook(eng.id)}
              />
            ))}
          </div>

          {/* Selected book toolbar tail: engagement-level actions */}
          {selected && (
            <div className="-mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-medium", DEAL_TYPE_STYLE[selected.type])}>
                  {DEAL_TYPE_SHORT[selected.type]}
                </span>
                <span className="font-medium tracking-tight">{selected.name}</span>
              </div>
              {isPartner && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground" aria-label="Engagement actions">
                        <span className="hidden sm:inline">Engagement</span>
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setTeamFor({ id: selected.id, name: selected.name })}>
                      <Users className="h-4 w-4 text-muted-foreground" aria-hidden /> Manage team
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditEngagement(true)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden /> Edit engagement
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* The book grid */}
          {selected && (
            <BookGrid key={selected.id} mandateId={selected.id} mandateName={selected.name} />
          )}
        </>
      )}

      {/* Dialogs */}
      {addEngagementOpen && (
        <MandateDialog
          projectId={project.id}
          defaultClientName={project.client_name}
          open={addEngagementOpen}
          onOpenChange={setAddEngagementOpen}
          trigger={null}
        />
      )}
      {editOpen && (
        <EditProjectDialog
          projectId={project.id}
          currentName={project.name}
          currentClientName={project.client_name}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {teamFor && (
        <TeamDialog
          mandateId={teamFor.id}
          mandateName={teamFor.name}
          open={!!teamFor}
          onOpenChange={(o) => !o && setTeamFor(null)}
        />
      )}
      {editEngagement && selectedMandate && (
        <MandateDialog
          mandate={selectedMandate}
          open={editEngagement}
          onOpenChange={setEditEngagement}
          trigger={null}
        />
      )}
    </div>
  );
}
