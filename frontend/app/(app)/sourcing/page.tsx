"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Database,
  Download,
  FolderPlus,
  History,
  Import,
  LineChart,
  Loader2,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CandidateRow } from "@/components/features/candidate-card";
import { PushToDialog } from "@/components/features/push-to-dialog";
import { SourcingKanban } from "@/components/features/sourcing-kanban";
import { EmptyState } from "@/components/features/empty-state";
import { api } from "@/lib/api";
import { useMandates } from "@/hooks/use-mandates";
import { useCategories } from "@/hooks/use-categories";
import {
  usePool,
  useAddCandidate,
  useBulkAddCandidates,
  buildPoolQS,
  type PoolFilters,
  type RevBand,
} from "@/hooks/use-candidates";
import { useSourcingFacets } from "@/hooks/use-sourcing-facets";
import { useSourcingStages, useChangeCandidateStage } from "@/hooks/use-sourcing-stages";
import { useCreateSavedSearch, useDeleteSavedSearch, useSavedSearches } from "@/hooks/use-saved-searches";
import { useScoreCandidates, useScoreFeedback } from "@/hooks/use-scores";
import { useFunnelAnalytics } from "@/hooks/use-funnel-analytics";
import { useAuth } from "@/hooks/use-auth";
import { dealLabel, ENGAGEMENT_TYPE_LABEL, ENGAGEMENT_SIDE_HINT } from "@/lib/labels";
import {
  DEAL_TYPE_STYLE,
  DISPLAY,
  LABEL,
  MONO,
  PAGE_TITLE,
  PAGE_TITLE_STYLE,
  SELECT_CLS,
} from "@/lib/design";
import { cn } from "@/lib/utils";
import type { MandateListItem, MandateType, SourcingPoolItem, SourcingPoolResponse } from "@/types";

const PAGE_SIZE = 25;
const SCORE_CAP = 200; // server page cap — "Score matches" scores at most this many
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TYPE_LABEL: Record<string, string> = { TARGET: "Target", BUYER: "Buyer", INVESTOR: "Investor" };

interface Criteria {
  q: string;
  hq: string;
  categoryId: number;
  type: string;
  band: RevBand | "";
  revMin: string; // legacy saved-search passthrough — no dedicated input
  headcountMin: string;
  warmOnly: boolean;
  hasScore: boolean;
  sort: PoolFilters["sort"];
}
const EMPTY_CRITERIA: Criteria = {
  q: "",
  hq: "",
  categoryId: 0,
  type: "",
  band: "",
  revMin: "",
  headcountMin: "",
  warmOnly: false,
  hasScore: false,
  sort: "score",
};

// ── Database lens — the page's signature instrument ─────────────────────────────
// The left rail reads the firm database back to the analyst: category mix, city
// mix, size bands, warm doors — each row a mono count over a share-of-database
// underbar, and each row IS the filter it describes. Discovery starts by seeing
// what the firm already owns, not by typing into a blank box. The Outreach desk's
// rail reads TIME, the Master List's tape reads STATE; the lens reads the POOL.

function LensRow({
  label,
  count,
  total,
  active,
  icon,
  onClick,
}: {
  label: string;
  count: number;
  total: number;
  active: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  const share = total > 0 ? (count / total) * 100 : 0;
  const quiet = count === 0;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      disabled={quiet && !active}
      className={cn(
        "group/lens flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary/[0.08] ring-1 ring-primary/30" : "hover:bg-muted/60",
        quiet && !active && "cursor-default opacity-45",
      )}
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 truncate text-xs",
            active ? "font-medium text-foreground" : "text-muted-foreground group-hover/lens:text-foreground",
          )}
        >
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span
          className={cn("shrink-0 text-[11px] font-semibold tabular-nums", active ? "text-primary-ink" : "text-foreground/70")}
          style={MONO}
        >
          {count}
        </span>
      </span>
      <span className="h-[2px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
        <span
          className={cn("horizon-load block h-full rounded-full", active ? "bg-primary" : "bg-foreground/25")}
          style={{ width: `${quiet ? 0 : Math.max(3, share)}%` }}
        />
      </span>
    </button>
  );
}

function LensGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

// ── Engagement switch — the deal-context anchor in the command line ─────────────
// Fit scores, warm history, and pushes are all computed against this engagement;
// it reads as the page title so the context is never in doubt.

function EngagementSwitch({
  mandates,
  current,
  onSelect,
}: {
  mandates: MandateListItem[];
  current: MandateListItem | undefined;
  onSelect: (id: number) => void;
}) {
  const label = current ? dealLabel(current.client_name, current.name) : { primary: "—", secondary: "" };
  return (
    // grow + a real flex-basis: the name takes the row's slack instead of
    // collapsing to its siblings' intrinsic width (which ellipsised it).
    <div className="min-w-0 grow basis-72">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sourcing for</span>
        {current && (
          <span className={cn("rounded px-1.5 py-px text-[11px] font-medium", DEAL_TYPE_STYLE[current.type])}>
            {ENGAGEMENT_TYPE_LABEL[current.type]}
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="group -ml-1 mt-0.5 flex max-w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Change engagement"
        >
          <span
            className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl"
            style={{ ...DISPLAY, letterSpacing: "-0.4px" }}
          >
            {label.primary}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[340px]" align="start">
          {mandates.map((m) => {
            const l = dealLabel(m.client_name, m.name);
            const active = m.id === current?.id;
            return (
              <DropdownMenuItem key={m.id} onClick={() => onSelect(m.id)} className="flex items-start gap-2 py-2">
                <Check className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary-ink" : "opacity-0")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{l.primary}</span>
                    <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-medium", DEAL_TYPE_STYLE[m.type])}>
                      {ENGAGEMENT_TYPE_LABEL[m.type]}
                    </span>
                  </span>
                  {l.secondary && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{l.secondary}</span>}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {label.secondary && <span className="text-foreground/80">{label.secondary}</span>}
        {label.secondary && current && " · "}
        {current && <span>{ENGAGEMENT_SIDE_HINT[current.type]}</span>}
      </p>
    </div>
  );
}

/** Criteria toggle chip — a pill that says exactly what it narrows to. */
function ToggleChip({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-primary/50 bg-primary/10 text-primary-ink"
          : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function SourcingPage() {
  const { user } = useAuth();
  const { data: mandates } = useMandates();
  const { data: categories } = useCategories();
  const [mandateId, setMandateId] = useState(0);
  const [c, setC] = useState<Criteria>(EMPTY_CRITERIA);
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"discover" | "funnel">("discover");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const [pushTarget, setPushTarget] = useState<SourcingPoolItem | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [scoringMatches, setScoringMatches] = useState(false);

  const mandateList = mandates?.items ?? [];
  const effectiveMandate = mandateId || mandateList[0]?.id || 0;
  const currentDeal = mandateList.find((m) => m.id === effectiveMandate);

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(c.q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [c.q]);

  const set = <K extends keyof Criteria>(k: K, v: Criteria[K]) => {
    setC((prev) => ({ ...prev, [k]: v }));
    if (k !== "q") setPage(1);
  };

  /** The current query, minus paging — reused by results, CSV export, and Score matches. */
  const criteria = useMemo(
    () => ({
      mandate_id: effectiveMandate,
      q: qDebounced || undefined,
      hq: c.hq || undefined,
      category_id: c.categoryId || undefined,
      type: c.type || undefined,
      rev_min: c.revMin || undefined,
      rev_band: c.band || undefined,
      headcount_min: c.headcountMin ? Number(c.headcountMin) : undefined,
      has_score: c.hasScore || undefined,
      warm_only: c.warmOnly || undefined,
      sort: c.sort,
    }),
    [effectiveMandate, qDebounced, c],
  );
  const filters: PoolFilters = useMemo(
    () => ({ ...criteria, page, page_size: PAGE_SIZE }),
    [criteria, page],
  );

  const pool = usePool(filters, effectiveMandate > 0 && view === "discover");
  const { data, isLoading, isFetching, isError } = pool;
  const { data: facets } = useSourcingFacets(effectiveMandate || undefined);
  const { data: coverage } = useFunnelAnalytics(effectiveMandate || undefined);
  const addCandidate = useAddCandidate();
  const bulkAdd = useBulkAddCandidates();
  const changeStage = useChangeCandidateStage();
  const { data: stagesData } = useSourcingStages();
  const savedSearches = useSavedSearches();
  const createSaved = useCreateSavedSearch();
  const deleteSaved = useDeleteSavedSearch();
  const scoreCandidates = useScoreCandidates();
  const scoreFeedback = useScoreFeedback();

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const poolTotal = facets?.total;
  const inFunnel = coverage?.pool_coverage.in_funnel;

  const activeCriteria = useMemo(
    () =>
      [
        c.categoryId && {
          label: categories?.items.find((x) => x.id === c.categoryId)?.name ?? "Category",
          clear: () => set("categoryId", 0),
        },
        c.type && { label: TYPE_LABEL[c.type] ?? c.type, clear: () => set("type", "") },
        c.hq && { label: `HQ: ${c.hq}`, clear: () => set("hq", "") },
        c.band && {
          label: facets?.size_bands.find((b) => b.key === c.band)?.label ?? "Size",
          clear: () => set("band", ""),
        },
        c.revMin && { label: `Rev ≥ ₹${c.revMin} Cr`, clear: () => set("revMin", "") },
        c.headcountMin && { label: `Staff ≥ ${c.headcountMin}`, clear: () => set("headcountMin", "") },
        c.warmOnly && { label: "Worked before", clear: () => set("warmOnly", false) },
        c.hasScore && { label: "Scored only", clear: () => set("hasScore", false) },
      ].filter(Boolean) as { label: string; clear: () => void }[],
    [c, categories, facets],
  );
  const activeCount = activeCriteria.length;

  const selectEngagement = (id: number) => {
    setMandateId(id);
    setSelected(new Set());
    setExpanded(new Set());
    setFocusIdx(-1);
    setPage(1);
  };

  const toggleSelect = (profileId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });

  const toggleExpand = (profileId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });

  /** AI-score every company matching the current query (server cap: first 200).
   *  Scoring materialises them as Research / Long-list candidates — this is the
   *  "build my long-list" action, not a passive annotation. */
  const scoreMatches = async () => {
    if (total === 0 || scoringMatches) return;
    setScoringMatches(true);
    try {
      const qs = buildPoolQS({ ...criteria, page: 1, page_size: SCORE_CAP });
      const matches = await api.get<SourcingPoolResponse>(`/sourcing/candidates${qs}`);
      const ids = matches.items.map((i) => i.profile_id);
      const res = await scoreCandidates.mutateAsync({ mandate_id: effectiveMandate, profile_ids: ids });
      toast.success(
        `${res.scored} scored, ${res.cached} cached${total > SCORE_CAP ? ` — top ${SCORE_CAP} of ${total} matches` : ""}${res.degraded ? " (AI degraded — some failed)" : ""}`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setScoringMatches(false);
    }
  };

  const scoreSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const res = await scoreCandidates.mutateAsync({ mandate_id: effectiveMandate, profile_ids: ids });
      toast.success(`${res.scored} scored, ${res.cached} cached${res.degraded ? " (AI degraded — some failed)" : ""}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scoring failed");
    }
  };

  const sendFeedback = async (candidateId: number, vote: "UP" | "DOWN") => {
    try {
      await scoreFeedback.mutateAsync({ candidateId, vote });
      toast.success("Thanks — feedback recorded");
    } catch {
      toast.error("Failed to record feedback");
    }
  };

  const shortlist = async (item: SourcingPoolItem) => {
    try {
      await addCandidate.mutateAsync({ mandate_id: effectiveMandate, profile_id: item.profile_id, stage_kind: "SHORTLIST" });
      toast.success(`${item.company_name} shortlisted`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to shortlist");
    }
  };

  const bulkShortlist = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const res = await bulkAdd.mutateAsync({ mandate_id: effectiveMandate, profile_ids: ids, stage_kind: "SHORTLIST" });
      setSelected(new Set());
      const researchStage = stagesData?.items.find((s) => s.kind === "RESEARCH");
      toast.success(`${res.count} shortlisted`, {
        action: researchStage
          ? {
              label: "Undo",
              onClick: async () => {
                await Promise.all(
                  res.candidate_ids.map((id) => changeStage.mutateAsync({ id, stageId: researchStage.id })),
                );
                toast.success("Undone");
              },
            }
          : undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Bulk shortlist failed");
    }
  };

  const saveCurrentSearch = async () => {
    const name = searchName.trim();
    if (!name) return;
    try {
      await createSaved.mutateAsync({
        name,
        scope: "PRIVATE",
        criteria: {
          q: qDebounced || undefined,
          hq: c.hq || undefined,
          category_id: c.categoryId || undefined,
          type: c.type || undefined,
          rev_band: c.band || undefined,
          rev_min: c.revMin || undefined,
          headcount_min: c.headcountMin ? Number(c.headcountMin) : undefined,
          warm_only: c.warmOnly || undefined,
          has_score: c.hasScore || undefined,
          sort: c.sort,
        },
      });
      toast.success("Search saved");
      setSearchName("");
      setSavingSearch(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const applySaved = (criteria: Record<string, unknown>) => {
    setC({
      q: (criteria.q as string) ?? "",
      hq: (criteria.hq as string) ?? "",
      categoryId: (criteria.category_id as number) ?? 0,
      type: (criteria.type as string) ?? "",
      band: (criteria.rev_band as RevBand) ?? "",
      revMin: (criteria.rev_min as string) ?? "",
      headcountMin: criteria.headcount_min ? String(criteria.headcount_min) : "",
      warmOnly: !!criteria.warm_only,
      hasScore: !!criteria.has_score,
      sort: (criteria.sort as PoolFilters["sort"]) ?? "score",
    });
    setQDebounced((criteria.q as string) ?? "");
    setPage(1);
    setView("discover");
  };

  const resetCriteria = () => setC((prev) => ({ ...EMPTY_CRITERIA, q: prev.q, sort: prev.sort }));

  // Keyboard focus stays honest when the list shrinks under it — derived, not stored.
  const fi = items.length === 0 ? -1 : Math.min(focusIdx, items.length - 1);

  // Keyboard: j/k move, x select, s shortlist, p push, e opens the "why". Only on
  // the Discover list — the funnel board owns drag & drop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== "discover") return;
      if (e.key === "Escape") {
        setSelected(new Set());
        setFocusIdx(-1);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing || document.querySelector('[role="dialog"]')) return;
      if (items.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx(Math.min(items.length - 1, fi + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx(fi < 0 ? 0 : Math.max(0, fi - 1));
      } else if (e.key === "x") {
        const it = items[fi];
        if (it) {
          e.preventDefault();
          toggleSelect(it.profile_id);
        }
      } else if (e.key === "s") {
        const it = items[fi];
        if (it && it.candidate?.stage_kind !== "SHORTLIST") {
          e.preventDefault();
          shortlist(it);
        }
      } else if (e.key === "p") {
        const it = items[fi];
        if (it) {
          e.preventDefault();
          setPushTarget(it);
        }
      } else if (e.key === "e" || e.key === "Enter") {
        const it = items[fi];
        if (it) {
          e.preventDefault();
          toggleExpand(it.profile_id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, items, fi]);

  useEffect(() => {
    if (fi < 0) return;
    (document.querySelector(`[data-row-index="${fi}"]`) as HTMLElement | null)?.scrollIntoView({
      block: "nearest",
    });
  }, [fi]);

  const csvHref = `${API_URL}/sourcing/candidates.csv${buildPoolQS(criteria as PoolFilters)}`;

  // ── Page-level gates: engagements still loading, or none assigned ──
  if (!mandates) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="hidden h-72 animate-pulse rounded-xl bg-muted lg:block" />
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (mandateList.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className={PAGE_TITLE} style={PAGE_TITLE_STYLE}>
          Sourcing
        </h1>
        <EmptyState
          icon={FolderPlus}
          title="No engagements to source for yet"
          description={
            user?.role === "PARTNER"
              ? "Sourcing scores and pushes companies against a specific deal. Create a project and an engagement (sell-side, buy-side, or capital-raise) to begin."
              : "You have no assigned engagements yet. Ask a partner to assign you to a deal, then come back to source companies for it."
          }
          action={
            user?.role === "PARTNER" ? (
              <Link href="/projects">
                <Button size="sm">
                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Go to Projects
                </Button>
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Command line — deal context left; view switch + occasional tools right ── */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <EngagementSwitch mandates={mandateList} current={currentDeal} onSelect={selectEngagement} />
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Sourcing view"
            className="inline-flex w-fit items-center rounded-lg bg-muted p-[3px] text-sm text-muted-foreground"
          >
            {(
              [
                { id: "discover", label: "Discover" },
                { id: "funnel", label: "Funnel" },
              ] as const
            ).map((t) => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls="sourcing-panel"
                  onClick={() => setView(t.id)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-3 font-medium outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                      : "hover:text-foreground",
                  )}
                >
                  {t.label}
                  {t.id === "funnel" && inFunnel != null && (
                    <span
                      className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
                      style={MONO}
                    >
                      {inFunnel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Link href="/sourcing/import">
            <Button variant="outline" size="sm" className="h-9">
              <Import className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Import
            </Button>
          </Link>
          <Link href="/sourcing/analytics">
            <Button variant="outline" size="sm" className="h-9">
              <LineChart className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Analytics
            </Button>
          </Link>
        </div>
      </div>

      <div role="tabpanel" id="sourcing-panel" aria-labelledby={`tab-${view}`} className="flex flex-col gap-4">
        {view === "funnel" ? (
          <SourcingKanban mandateId={effectiveMandate} />
        ) : (
          <>
            {/* ── Query deck — ask the database ── */}
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-ink" aria-hidden />
                <Input
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Search the firm database"
                  value={c.q}
                  onChange={(e) => set("q", e.target.value)}
                  placeholder={
                    poolTotal != null
                      ? `Search ${poolTotal.toLocaleString("en-IN")} companies — name, city, or domain…`
                      : "Search the firm database — name, city, or domain…"
                  }
                  className="h-12 rounded-xl pl-11 !text-[15px]"
                />
                {c.q && (
                  <button
                    onClick={() => set("q", "")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              {/* Criteria — always visible; discovery filters are first-class here */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={c.categoryId}
                  onChange={(e) => set("categoryId", Number(e.target.value))}
                  className={SELECT_CLS}
                  aria-label="Category"
                >
                  <option value={0}>All categories</option>
                  {categories?.items.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <select
                  value={c.type}
                  onChange={(e) => set("type", e.target.value)}
                  className={SELECT_CLS}
                  aria-label="Counterparty type"
                >
                  <option value="">Any type</option>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={c.band}
                  onChange={(e) => set("band", e.target.value as Criteria["band"])}
                  className={SELECT_CLS}
                  aria-label="Revenue size"
                >
                  <option value="">Any size</option>
                  {(facets?.size_bands ?? []).map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={c.hq}
                  onChange={(e) => set("hq", e.target.value)}
                  placeholder="HQ city"
                  aria-label="HQ city"
                  className="h-8 w-28 text-xs"
                />
                <Input
                  inputMode="numeric"
                  value={c.headcountMin}
                  onChange={(e) => set("headcountMin", e.target.value)}
                  placeholder="Staff ≥"
                  aria-label="Minimum headcount"
                  className="h-8 w-20 text-xs"
                />
                <ToggleChip
                  label="Worked before"
                  active={c.warmOnly}
                  icon={<History className="h-3 w-3" aria-hidden />}
                  onClick={() => set("warmOnly", !c.warmOnly)}
                />
                <ToggleChip
                  label="Scored"
                  active={c.hasScore}
                  icon={<Sparkles className="h-3 w-3" aria-hidden />}
                  onClick={() => set("hasScore", !c.hasScore)}
                />
                {activeCount > 0 && (
                  <button
                    onClick={resetCriteria}
                    className="rounded text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    Reset
                  </button>
                )}
                <div className="ml-auto">
                  {savingSearch ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveCurrentSearch()}
                        placeholder="Name this search…"
                        className="h-8 w-36 text-xs"
                      />
                      <Button size="sm" className="h-8" onClick={saveCurrentSearch} disabled={createSaved.isPending}>
                        Save
                      </Button>
                      <button
                        onClick={() => setSavingSearch(false)}
                        aria-label="Cancel saving search"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setSavingSearch(true)}>
                      <Bookmark className="mr-1 h-3.5 w-3.5" aria-hidden /> Save search
                    </Button>
                  )}
                </div>
              </div>

              {/* Readout — what the query returned, and what to do with it */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="h-3.5 w-3.5" aria-hidden />
                  <span>
                    <span key={total} className="count-pop inline-block font-semibold tabular-nums text-foreground" style={MONO}>
                      {isLoading ? "—" : total.toLocaleString("en-IN")}
                    </span>
                    {poolTotal != null && (
                      <span>
                        {" "}of{" "}
                        <span className="tabular-nums" style={MONO}>
                          {poolTotal.toLocaleString("en-IN")}
                        </span>
                      </span>
                    )}{" "}
                    {total === 1 ? "company matches" : "companies match"}
                  </span>
                  {isFetching && !isLoading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={c.sort}
                    onChange={(e) => set("sort", e.target.value as PoolFilters["sort"])}
                    className={SELECT_CLS}
                    aria-label="Sort results"
                  >
                    <option value="score">Sort: Best fit</option>
                    <option value="name">Sort: Name</option>
                    <option value="rev">Sort: Revenue</option>
                  </select>
                  <a
                    href={csvHref}
                    title="Export the current results as CSV (first 200)"
                    aria-label="Export results as CSV"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={scoreMatches}
                    disabled={scoringMatches || total === 0}
                    title={`AI-score every match (up to ${SCORE_CAP}) against this deal's thesis — they join Research / Long-list`}
                  >
                    {scoringMatches ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    )}
                    {scoringMatches ? "Scoring…" : "Score matches"}
                  </Button>
                </div>
              </div>
            </section>

            {/* ── Saved searches ── */}
            {(savedSearches.data?.items.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Saved:</span>
                {savedSearches.data!.items.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-0.5 rounded-full border py-0.5 pl-2.5 pr-1 text-xs">
                    <button
                      onClick={() => applySaved(s.criteria)}
                      className="rounded py-0.5 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {s.name}
                    </button>
                    <button
                      onClick={() => deleteSaved.mutate(s.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive-ink focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Delete saved search ${s.name}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ── Lens + results ── */}
            <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              {/* Database lens — composition of the pool; every row is also a filter */}
              <aside className="sticky top-4 hidden flex-col gap-4 rounded-xl border border-border bg-card p-3 lg:flex">
                <div className="px-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    The database
                  </div>
                  <div className="mt-0.5 text-lg font-semibold leading-none tabular-nums" style={MONO}>
                    {poolTotal != null ? poolTotal.toLocaleString("en-IN") : "—"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">companies, firm-wide</div>
                </div>
                {facets ? (
                  <>
                    <LensGroup title="Signals">
                      <LensRow
                        label="Worked before"
                        icon={<History className="h-3 w-3 shrink-0 text-primary-ink/70" aria-hidden />}
                        count={facets.warm}
                        total={facets.total}
                        active={c.warmOnly}
                        onClick={() => set("warmOnly", !c.warmOnly)}
                      />
                      <LensRow
                        label="Scored for this deal"
                        icon={<Sparkles className="h-3 w-3 shrink-0 text-primary-ink/70" aria-hidden />}
                        count={facets.scored}
                        total={facets.total}
                        active={c.hasScore}
                        onClick={() => set("hasScore", !c.hasScore)}
                      />
                    </LensGroup>
                    {facets.by_category.length > 0 && (
                      <LensGroup title="Category">
                        {facets.by_category.slice(0, 8).map((cat) => (
                          <LensRow
                            key={cat.id}
                            label={cat.name}
                            count={cat.count}
                            total={facets.total}
                            active={c.categoryId === cat.id}
                            onClick={() => set("categoryId", c.categoryId === cat.id ? 0 : cat.id)}
                          />
                        ))}
                      </LensGroup>
                    )}
                    {facets.by_hq.length > 0 && (
                      <LensGroup title="HQ">
                        {facets.by_hq.map((h) => (
                          <LensRow
                            key={h.hq}
                            label={h.hq}
                            count={h.count}
                            total={facets.total}
                            active={c.hq.toLowerCase() === h.hq.toLowerCase()}
                            onClick={() => set("hq", c.hq.toLowerCase() === h.hq.toLowerCase() ? "" : h.hq)}
                          />
                        ))}
                      </LensGroup>
                    )}
                    <LensGroup title="Size">
                      {facets.size_bands.map((b) => (
                        <LensRow
                          key={b.key}
                          label={b.label}
                          count={b.count}
                          total={facets.total}
                          active={c.band === b.key}
                          onClick={() => set("band", c.band === b.key ? "" : b.key)}
                        />
                      ))}
                    </LensGroup>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 px-2">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="h-6 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                )}
              </aside>

              {/* Results */}
              <div className="flex min-w-0 flex-col gap-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden />
                      <p className="text-sm font-medium">Couldn&rsquo;t load the database.</p>
                      <button onClick={() => pool.refetch()} className="text-xs font-medium text-primary-ink hover:underline">
                        Try again
                      </button>
                    </div>
                  ) : isLoading ? (
                    <div className="divide-y divide-border">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div key={n} className="flex items-stretch">
                          <div className="w-[58px] shrink-0 animate-pulse bg-muted/60" />
                          <div className="flex-1 space-y-2 px-4 py-3.5">
                            <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <Database className="h-6 w-6 text-muted-foreground" aria-hidden />
                      <p className="text-sm font-medium">
                        {poolTotal === 0 ? "The database is empty." : "No companies match."}
                      </p>
                      {poolTotal === 0 ? (
                        <Link href="/sourcing/import" className="text-xs font-medium text-primary-ink hover:underline">
                          Import your first list to start sourcing
                        </Link>
                      ) : activeCount > 0 || qDebounced ? (
                        <button
                          onClick={() => {
                            resetCriteria();
                            set("q", "");
                          }}
                          className="text-xs font-medium text-primary-ink hover:underline"
                        >
                          Clear search &amp; criteria
                        </button>
                      ) : (
                        <Link href="/sourcing/import" className="text-xs font-medium text-primary-ink hover:underline">
                          Import a list to grow the database
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {items.map((item, i) => (
                        <div
                          key={item.profile_id}
                          data-row-index={i}
                          className={cn(
                            "data-row",
                            fi === i && "bg-primary/[0.05] ring-1 ring-inset ring-primary/40",
                          )}
                          style={{ "--row-i": Math.min(i, 14) } as CSSProperties}
                        >
                          <CandidateRow
                            item={item}
                            index={i}
                            onShortlist={shortlist}
                            onPush={setPushTarget}
                            onFeedback={sendFeedback}
                            selectable
                            selected={selected.has(item.profile_id)}
                            anySelected={selected.size > 0}
                            onToggleSelect={toggleSelect}
                            expanded={expanded.has(item.profile_id)}
                            onToggleExpand={() => toggleExpand(item.profile_id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums" style={MONO}>
                      Page {page} / {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next <ChevronRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Shortcut hint — one quiet line under the work, not chrome above it. */}
                {items.length > 0 && (
                  <p className="hidden text-center text-[11px] text-muted-foreground lg:block">
                    <kbd className="rounded border bg-muted px-1 font-mono">j</kbd>/<kbd className="rounded border bg-muted px-1 font-mono">k</kbd> move ·{" "}
                    <kbd className="rounded border bg-muted px-1 font-mono">x</kbd> select ·{" "}
                    <kbd className="rounded border bg-muted px-1 font-mono">s</kbd> shortlist ·{" "}
                    <kbd className="rounded border bg-muted px-1 font-mono">p</kbd> push ·{" "}
                    <kbd className="rounded border bg-muted px-1 font-mono">e</kbd> why
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && view === "discover" && (
        <div
          className="bar-rise fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-primary/20 bg-card px-4 py-2 shadow-lg shadow-primary/5"
          role="status"
        >
          <span className="text-sm font-medium">
            <span className="tabular-nums" style={MONO}>
              {selected.size}
            </span>{" "}
            selected
          </span>
          <Button size="sm" className="h-7 text-xs" onClick={bulkShortlist} disabled={bulkAdd.isPending}>
            <Star className="mr-1 h-3 w-3" aria-hidden /> Shortlist
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={scoreSelected}
            disabled={scoreCandidates.isPending}
            title="AI-score the selected companies against this deal"
          >
            {scoreCandidates.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" aria-hidden />
            )}
            Score
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {pushTarget && (
        <PushToDialog
          open={!!pushTarget}
          onOpenChange={(o) => !o && setPushTarget(null)}
          profileId={pushTarget.profile_id}
          companyName={pushTarget.company_name}
          defaultProjectId={currentDeal?.project_id ?? undefined}
          defaultSide={currentDeal?.type}
        />
      )}
    </div>
  );
}
